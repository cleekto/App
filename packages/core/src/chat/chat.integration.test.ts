import { prisma } from '@kleekto/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthContext } from '../auth/context';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { seed } from '../seed/seed';
import {
  createChatRoom,
  deleteChatMessage,
  editChatMessage,
  listChatMessages,
  listChatRooms,
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

  it('ТЕКСТ УДАЛЁННОГО НЕ ОТДАЁТСЯ ВОВСЕ', async () => {
    const roomId = await roomFor(actors.admin, 'Скрытое');
    const message = await postChatMessage(actors.agent, { roomId }, 'Секретный номер 555');
    await deleteChatMessage(actors.agent, message.id);

    const messages = await listChatMessages(actors.otherAgent, { roomId });
    const deleted = messages.find((row) => row.id === message.id);

    // Прятать текст на экране мало: он всё равно уехал бы в браузер
    // и лежал бы в ответе сервера.
    expect(deleted?.isDeleted).toBe(true);
    expect(deleted?.body).toBeNull();
    expect(JSON.stringify(messages)).not.toContain('555');
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
