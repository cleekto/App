import { prisma } from '@kleekto/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthContext } from '../auth/context';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { seed } from '../seed/seed';
import {
  companyFeed,
  createChatRoom,
  createChatTopic,
  deleteChatMessage,
  editChatMessage,
  listChatMessages,
  listChatRooms,
  listChatTopics,
  listDirectConversations,
  openDirectConversation,
  postChatMessage,
  updateChatRoom,
} from './use-cases';

/**
 * Чат компании и личная переписка.
 *
 * Главное, что здесь проверяется, — не «сообщение отправилось», а границы:
 * чужая компания не видна нигде, чужая личная переписка не видна никому,
 * включая администратора, и удалять чужое может только тот, кому это
 * разрешено.
 */

interface Actors {
  admin: AuthContext;
  manager: AuthContext;
  agent: AuthContext;
  otherAgent: AuthContext;
  batumiAdmin: AuthContext;
}

let actors: Actors;

async function contextFor(email: string): Promise<AuthContext> {
  const user = await prisma.user.findFirstOrThrow({
    where: { email },
    include: { role: true, teamMemberships: true },
  });

  return {
    userId: user.id,
    companyId: user.companyId,
    teamId: user.teamMemberships[0]?.teamId ?? null,
    role: user.role.code,
    locale: user.locale,
  };
}

beforeAll(async () => {
  await seed();
  actors = {
    admin: await contextFor('admin@tbilisi-estate.test'),
    manager: await contextFor('manager@tbilisi-estate.test'),
    agent: await contextFor('agent1@tbilisi-estate.test'),
    otherAgent: await contextFor('agent3@tbilisi-estate.test'),
    batumiAdmin: await contextFor('admin@batumi-property.test'),
  };
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

async function roomFor(ctx: AuthContext, name: string): Promise<string> {
  const room = await createChatRoom(ctx, { name });
  return room.id;
}

describe('комнаты общего чата', () => {
  it('создают администратор и менеджер, агент — нет', async () => {
    await expect(createChatRoom(actors.admin, { name: 'Объявления' })).resolves.toBeTruthy();
    await expect(createChatRoom(actors.manager, { name: 'Ваке' })).resolves.toBeTruthy();

    // Решение владельца: комнаты заводят менеджеры и администраторы.
    await expect(createChatRoom(actors.agent, { name: 'Своя' })).rejects.toThrow(ForbiddenError);
  });

  it('комната видна всей компании, включая агентов чужой команды', async () => {
    const roomId = await roomFor(actors.manager, 'Общий');

    // Открытость комнат — решение владельца: чат объявлен общим для компании.
    for (const actor of [actors.admin, actors.agent, actors.otherAgent]) {
      const rooms = await listChatRooms(actor);
      expect(rooms.map((room) => room.id)).toContain(roomId);
    }
  });

  it('комнаты чужой компании не видны и не открываются', async () => {
    const roomId = await roomFor(actors.admin, 'Только для Тбилиси');

    const foreign = await listChatRooms(actors.batumiAdmin);
    expect(foreign.map((room) => room.id)).not.toContain(roomId);

    // Не «видно, но откажут», а не существует для чужой компании.
    await expect(postChatMessage(actors.batumiAdmin, { roomId }, 'Привет')).rejects.toThrow(
      NotFoundError,
    );
    await expect(listChatMessages(actors.batumiAdmin, { roomId })).rejects.toThrow(NotFoundError);
  });

  it('архивная комната уходит из списка, но история остаётся', async () => {
    const roomId = await roomFor(actors.admin, 'Старая');
    await postChatMessage(actors.agent, { roomId }, 'Было дело');

    await updateChatRoom(actors.admin, roomId, { isArchived: true });

    const visible = await listChatRooms(actors.agent);
    expect(visible.map((room) => room.id)).not.toContain(roomId);

    // Удаления комнат нет намеренно: вместе с ней исчезла бы переписка.
    const messages = await listChatMessages(actors.agent, { roomId });
    expect(messages).toHaveLength(1);
  });
});

describe('сообщения в комнате', () => {
  it('писать может любой сотрудник компании', async () => {
    const roomId = await roomFor(actors.admin, 'Кто пишет');

    await postChatMessage(actors.agent, { roomId }, 'От агента');
    await postChatMessage(actors.manager, { roomId }, 'От менеджера');

    const messages = await listChatMessages(actors.otherAgent, { roomId });
    expect(messages.map((message) => message.body)).toEqual(['От агента', 'От менеджера']);
  });

  it('пустое сообщение не отправляется', async () => {
    const roomId = await roomFor(actors.admin, 'Пустое');
    await expect(postChatMessage(actors.agent, { roomId }, '   ')).rejects.toThrow(ValidationError);
  });

  it('править можно только своё, и администратор не исключение', async () => {
    const roomId = await roomFor(actors.admin, 'Правки');
    const message = await postChatMessage(actors.agent, { roomId }, 'Сказал агент');

    await expect(editChatMessage(actors.agent, message.id, 'Уточнил агент')).resolves.toBeTruthy();

    // Приписать коллеге слова, которых он не говорил, не должен никто.
    await expect(editChatMessage(actors.admin, message.id, 'Подменил админ')).rejects.toThrow(
      ForbiddenError,
    );

    const [visible] = await listChatMessages(actors.agent, { roomId });
    expect(visible?.body).toBe('Уточнил агент');
    expect(visible?.editedAt).not.toBeNull();
  });

  it('автор удаляет своё, администратор — любое, агент чужое — нет', async () => {
    const roomId = await roomFor(actors.admin, 'Удаление');
    const own = await postChatMessage(actors.agent, { roomId }, 'Своё');
    const foreign = await postChatMessage(actors.manager, { roomId }, 'Чужое');

    await expect(deleteChatMessage(actors.agent, own.id)).resolves.toBeTruthy();
    await expect(deleteChatMessage(actors.agent, foreign.id)).rejects.toThrow(ForbiddenError);
    await expect(deleteChatMessage(actors.admin, foreign.id)).resolves.toBeTruthy();
  });

  /*
   * Метки в этих проверках нарочно кириллические. Цифровые давали ложные
   * срабатывания: «321» находится внутри случайного UUID, и тест падал
   * на исправном коде. В шестнадцатеричном идентификаторе кириллицы быть
   * не может, поэтому совпадение означает настоящую утечку.
   */
  it('ТЕКСТ УДАЛЁННОГО НЕ ОТДАЁТСЯ ВОВСЕ', async () => {
    const roomId = await roomFor(actors.admin, 'Скрытое');
    const message = await postChatMessage(actors.agent, { roomId }, 'Секретный номер ЯБЛОКО');
    await deleteChatMessage(actors.agent, message.id);

    const messages = await listChatMessages(actors.otherAgent, { roomId });
    const deleted = messages.find((row) => row.id === message.id);

    // Прятать текст на экране мало: он всё равно уехал бы в браузер
    // и лежал бы в ответе сервера.
    expect(deleted?.isDeleted).toBe(true);
    expect(deleted?.body).toBeNull();
    expect(JSON.stringify(messages)).not.toContain('ЯБЛОКО');
  });
});

describe('личная переписка', () => {
  it('одна и та же пара получает одну переписку, кто бы ни написал первым', async () => {
    const first = await openDirectConversation(actors.agent, actors.manager.userId);
    const second = await openDirectConversation(actors.manager, actors.agent.userId);

    // Без нормализации пары эти двое завели бы две переписки, и половина
    // сообщений оказалась бы «в другой».
    expect(second.id).toBe(first.id);
  });

  it('написать самому себе нельзя', async () => {
    await expect(openDirectConversation(actors.agent, actors.agent.userId)).rejects.toThrow(
      ValidationError,
    );
  });

  it('человек из чужой компании не находится', async () => {
    await expect(openDirectConversation(actors.agent, actors.batumiAdmin.userId)).rejects.toThrow(
      NotFoundError,
    );
  });

  /**
   * ГЛАВНАЯ ПРОВЕРКА ЭТОГО НАБОРА.
   *
   * Личная переписка не видна никому, кроме двоих, — и администратор здесь
   * не исключение. Читать переписку сотрудников — не право роли, а слежка,
   * и такой возможности в продукте нет.
   */
  it('чужую переписку не видит даже администратор', async () => {
    const conversation = await openDirectConversation(actors.agent, actors.otherAgent.userId);
    await postChatMessage(actors.agent, { conversationId: conversation.id }, 'Только между нами');

    await expect(
      listChatMessages(actors.admin, { conversationId: conversation.id }),
    ).rejects.toThrow(NotFoundError);

    await expect(
      postChatMessage(actors.admin, { conversationId: conversation.id }, 'Вмешался'),
    ).rejects.toThrow(NotFoundError);

    // И удалить чужое сообщение в чужой переписке администратор тоже
    // не может: «удалить не читая» — способ обойти это ограничение.
    const [message] = await listChatMessages(actors.agent, { conversationId: conversation.id });
    expect(message).toBeDefined();
    await expect(deleteChatMessage(actors.admin, message?.id ?? '')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('список переписок показывает собеседника, а не саму запись', async () => {
    const conversation = await openDirectConversation(actors.agent, actors.manager.userId);
    await postChatMessage(actors.agent, { conversationId: conversation.id }, 'Привет');

    const mine = await listDirectConversations(actors.agent);
    const row = mine.find((item) => item.id === conversation.id);

    expect(row?.partnerUserId).toBe(actors.manager.userId);
    expect(row?.partnerName).not.toBe('');

    // У собеседника та же переписка показывается наоборот.
    const theirs = await listDirectConversations(actors.manager);
    expect(theirs.find((item) => item.id === conversation.id)?.partnerUserId).toBe(
      actors.agent.userId,
    );
  });

  it('сообщение не может быть сразу и в комнате, и в переписке', async () => {
    const roomId = await roomFor(actors.admin, 'Обе цели');
    const conversation = await openDirectConversation(actors.agent, actors.manager.userId);

    await expect(
      postChatMessage(actors.agent, { roomId, conversationId: conversation.id }, 'Куда?'),
    ).rejects.toThrow(ValidationError);

    await expect(postChatMessage(actors.agent, {}, 'Никуда')).rejects.toThrow(ValidationError);
  });
});

describe('темы внутри комнаты', () => {
  it('тему заводит любой сотрудник, в отличие от комнаты', async () => {
    const roomId = await roomFor(actors.admin, 'С темами');

    // Начать разговор — не то же самое, что завести круг людей: комнату
    // агент создать не может, тему — может.
    await expect(createChatTopic(actors.agent, roomId, 'Жванияс 5')).resolves.toBeTruthy();
  });

  it('сообщения темы не смешиваются с общей лентой комнаты', async () => {
    const roomId = await roomFor(actors.admin, 'Разделение');
    const topic = await createChatTopic(actors.agent, roomId, 'Торг');

    await postChatMessage(actors.agent, { roomId }, 'В комнате');
    await postChatMessage(actors.agent, { roomId, topicId: topic.id }, 'В теме');

    const inRoom = await listChatMessages(actors.agent, { roomId });
    const inTopic = await listChatMessages(actors.agent, { roomId, topicId: topic.id });

    expect(inRoom.map((message) => message.body)).toEqual(['В комнате']);
    expect(inTopic.map((message) => message.body)).toEqual(['В теме']);
  });

  it('в тему соседней комнаты написать нельзя', async () => {
    const first = await roomFor(actors.admin, 'Первая');
    const second = await roomFor(actors.admin, 'Вторая');
    const topic = await createChatTopic(actors.agent, first, 'Своя тема');

    // Знание идентификатора не должно давать доступ.
    await expect(
      postChatMessage(actors.agent, { roomId: second, topicId: topic.id }, 'Мимо'),
    ).rejects.toThrow(NotFoundError);
  });

  it('у личной переписки тем не бывает', async () => {
    const conversation = await openDirectConversation(actors.agent, actors.manager.userId);

    await expect(
      listChatMessages(actors.agent, {
        conversationId: conversation.id,
        topicId: '00000000-0000-0000-0000-000000000001',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('темы комнаты перечисляются со счётчиком', async () => {
    const roomId = await roomFor(actors.admin, 'Счётчик тем');
    const topic = await createChatTopic(actors.agent, roomId, 'Обсуждение');
    await postChatMessage(actors.agent, { roomId, topicId: topic.id }, 'Раз');
    await postChatMessage(actors.manager, { roomId, topicId: topic.id }, 'Два');

    const topics = await listChatTopics(actors.otherAgent, roomId);
    expect(topics.find((item) => item.id === topic.id)?.messageCount).toBe(2);
  });
});

describe('ответ на сообщение', () => {
  it('ответ приводит цитату исходного', async () => {
    const roomId = await roomFor(actors.admin, 'Ответы');
    const original = await postChatMessage(actors.manager, { roomId }, 'Когда показ?');
    await postChatMessage(actors.agent, { roomId }, 'Завтра в шесть', {
      replyToId: original.id,
    });

    const messages = await listChatMessages(actors.agent, { roomId });
    const answer = messages.at(-1);

    expect(answer?.replyTo?.body).toBe('Когда показ?');
    expect(answer?.replyTo?.authorName).not.toBe('');
  });

  /**
   * ГЛАВНАЯ ПРОВЕРКА ЭТОГО НАБОРА.
   *
   * Без проверки принадлежности можно было бы ответить в своей переписке
   * на сообщение из чужой — и процитированный текст утёк бы вместе с ответом.
   */
  it('ОТВЕТ НА ЧУЖОЙ РАЗГОВОР НЕ ТАЩИТ ЕГО ТЕКСТ', async () => {
    const roomId = await roomFor(actors.admin, 'Источник');
    const secret = await postChatMessage(actors.manager, { roomId }, 'Секрет-ГРУША');

    const conversation = await openDirectConversation(actors.agent, actors.otherAgent.userId);
    await postChatMessage(actors.agent, { conversationId: conversation.id }, 'Смотри', {
      replyToId: secret.id,
    });

    const messages = await listChatMessages(actors.agent, { conversationId: conversation.id });

    // Сообщение осталось — потерять написанное из-за чужой ссылки нельзя, —
    // но цитаты в нём нет.
    expect(messages.at(-1)?.body).toBe('Смотри');
    expect(messages.at(-1)?.replyTo).toBeNull();
    expect(JSON.stringify(messages)).not.toContain('ГРУША');
  });

  it('удаление исходного не уносит ответ, а только цитату', async () => {
    const roomId = await roomFor(actors.admin, 'Удаление цитаты');
    const original = await postChatMessage(actors.agent, { roomId }, 'Исходное');
    await postChatMessage(actors.manager, { roomId }, 'Ответ на него', {
      replyToId: original.id,
    });

    await deleteChatMessage(actors.agent, original.id);

    const messages = await listChatMessages(actors.otherAgent, { roomId });
    const answer = messages.find((message) => message.body === 'Ответ на него');

    expect(answer).toBeDefined();
    expect(answer?.replyTo?.body).toBeNull();
  });
});

describe('общая лента компании', () => {
  it('собирает сообщения из всех комнат и говорит, откуда каждое', async () => {
    const first = await roomFor(actors.admin, 'Лента-1');
    const second = await roomFor(actors.admin, 'Лента-2');
    await postChatMessage(actors.agent, { roomId: first }, 'Из первой');
    await postChatMessage(actors.manager, { roomId: second }, 'Из второй');

    const feed = await companyFeed(actors.otherAgent);
    const bodies = feed.map((item) => item.body);

    expect(bodies).toContain('Из первой');
    expect(bodies).toContain('Из второй');
    expect(feed.find((item) => item.body === 'Из первой')?.roomName).toBe('Лента-1');
  });

  it('ЛИЧНОЙ ПЕРЕПИСКИ В ЛЕНТЕ НЕТ', async () => {
    const conversation = await openDirectConversation(actors.agent, actors.manager.userId);
    await postChatMessage(actors.agent, { conversationId: conversation.id }, 'Личное-СЛИВА');

    // Лента общая для компании; личное в ней означало бы, что переписку
    // видят все.
    const feed = await companyFeed(actors.admin);
    expect(JSON.stringify(feed)).not.toContain('СЛИВА');
  });

  it('лента чужой компании не пересекается с нашей', async () => {
    const roomId = await roomFor(actors.admin, 'Только Тбилиси');
    await postChatMessage(actors.agent, { roomId }, 'Тбилисское-ВИШНЯ');

    const foreign = await companyFeed(actors.batumiAdmin);
    expect(JSON.stringify(foreign)).not.toContain('ВИШНЯ');
  });

  it('архивная комната из ленты уходит', async () => {
    const roomId = await roomFor(actors.admin, 'Уйдёт в архив');
    await postChatMessage(actors.agent, { roomId }, 'Было-АЙВА');
    await updateChatRoom(actors.admin, roomId, { isArchived: true });

    const feed = await companyFeed(actors.agent);
    expect(JSON.stringify(feed)).not.toContain('АЙВА');
  });
});
