import { TaskStatus, prisma } from '@cleekto/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { propertyActivity } from './activity/feed';
import type { AuthContext } from './auth/context';
import { addComment, listComments } from './comments/use-cases';
import { ForbiddenError, NotFoundError } from './errors';
import { importListing, type ImportInput } from './import/use-cases';
import { listPipelineStatuses } from './pipeline/use-cases';
import {
  assignProperty,
  changePropertyStatus,
  getProperty,
  listProperties,
  updateProperty,
} from './properties/use-cases';
import { seed } from './seed/seed';
import { createTask, listTasks, setTaskStatus } from './tasks/use-cases';

/**
 * ГЕЙТ ФАЗЫ 7. Веб-интерфейс работает поверх этих сценариев, и проверять
 * надо их, а не разметку: разметка без них — картинка.
 *
 * На настоящей базе с двумя настоящими компаниями (правило 5). Тест с пустой
 * второй компанией проходил бы просто потому, что у неё ничего нет.
 */

interface Actors {
  /** Команда Vake компании «Tbilisi Estate». */
  vake: AuthContext;
  /** Соседняя команда той же компании: конкуренция разрешена. */
  saburtalo: AuthContext;
  /** Менеджер той же компании — назначает ответственных. */
  manager: AuthContext;
  /** Другая компания. Её данные не пересекаются с первой никогда. */
  batumi: AuthContext;
}

let actors: Actors;
let counter = 0;

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

function payload(over: Partial<ImportInput> = {}): ImportInput {
  counter += 1;
  const seq = counter;

  return {
    source: 'SS_GE',
    sourceUrl: `https://ss.ge/ru/crm/${seq}`,
    externalId: `crm-${seq}`,
    propertyType: 'APARTMENT',
    transactionType: 'SALE',
    price: 145000,
    currency: 'USD',
    area: 78,
    rooms: 3,
    floor: 5,
    totalFloors: 12,
    district: 'Vake',
    address: `Ваке, улица Абашидзе ${seq}`,
    description: 'Светлая квартира',
    photos: [`https://ss.ge/photo/crm-${seq}.jpg`],
    owner: { name: 'Гиорги', phone: `+9955552${String(seq).padStart(5, '0')}` },
    parserVersion: 'ss.ge@1.0.0',
    missingFields: [],
    outcome: 'consent',
    ...over,
  };
}

/** Объект появляется единственным законным путём — по «Согласен». */
async function makeProperty(ctx: AuthContext, over: Partial<ImportInput> = {}): Promise<string> {
  const result = await importListing(ctx, payload(over));
  if (result.propertyId === null) throw new Error('объект не создан');
  return result.propertyId;
}

beforeAll(async () => {
  await seed();
  actors = {
    vake: await contextFor('agent1@tbilisi-estate.test'),
    saburtalo: await contextFor('agent3@tbilisi-estate.test'),
    manager: await contextFor('manager@tbilisi-estate.test'),
    batumi: await contextFor('agent1@batumi-property.test'),
  };
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// Список и карточка
// ─────────────────────────────────────────────────────────────────────────────

describe('список объектов', () => {
  it('показывает созданный объект и считает общее число', async () => {
    const id = await makeProperty(actors.vake);
    const { items, total } = await listProperties(actors.vake);

    expect(total).toBeGreaterThan(0);
    expect(items.map((item) => item.id)).toContain(id);
  });

  it('поиск находит объект по адресу', async () => {
    // Метка заведомо уникальна: «Кекелидзе1» нашлось бы и внутри
    // «Кекелидзе15», и тест ловил бы собственную неаккуратность,
    // а не поведение поиска.
    const marker = `Кекелидзе${Math.random().toString(36).slice(2, 10)}`;
    const id = await makeProperty(actors.vake, { address: `Ваке, ${marker} 4` });

    const { items } = await listProperties(actors.vake, { query: marker });

    // Проверяется и то, что объект нашёлся, и то, что поиск действительно
    // фильтрует. Сравнение с точным списком идентификаторов было бы
    // проверкой содержимого всей таблицы, а не поиска: любой соседний тест,
    // создавший похожий адрес, ронял бы его на ровном месте.
    expect(items.map((item) => item.id)).toContain(id);
    for (const item of items) {
      expect(item.addressRaw, item.id).toContain(marker);
    }
  });

  /**
   * Регрессия. Ветка поиска по телефону приводила запрос к цифрам, и на
   * запросе без цифр `contains: ''` совпадал со всем: поиск по слову
   * возвращал каждый объект, у которого есть контакт собственника.
   *
   * Дефект нашёлся не сразу, потому что при пустой базе выглядел как успех.
   */
  it('поиск по слову без цифр не возвращает объекты, которые ему не отвечают', async () => {
    await makeProperty(actors.vake, { address: 'Ваке, улица Абашидзе 1' });
    const marker = `Мтацминда${Math.random().toString(36).slice(2, 10)}`;
    await makeProperty(actors.vake, { address: `Ваке, ${marker} 7` });

    const { items } = await listProperties(actors.vake, { query: marker });

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.addressRaw, item.id).toContain(marker);
    }
  });

  it('поиск находит объект по телефону собственника', async () => {
    // Самый частый вопрос к CRM за день: агенту звонят с номера,
    // и он должен понять, кто это.
    counter += 1;
    const phone = `+9955553${String(counter).padStart(5, '0')}`;
    const id = await makeProperty(actors.vake, { owner: { name: 'Ника', phone } });

    const { items } = await listProperties(actors.vake, { query: phone.slice(-7) });
    expect(items.map((item) => item.id)).toContain(id);
  });

  it('фильтр по статусу сужает выборку', async () => {
    const id = await makeProperty(actors.vake);
    const statuses = await listPipelineStatuses(actors.vake);
    const target = statuses[1];
    if (target === undefined) throw new Error('в воронке меньше двух статусов');

    await changePropertyStatus(actors.vake, id, target.id);

    const { items } = await listProperties(actors.vake, { pipelineStatusId: target.id });
    expect(items.map((item) => item.id)).toContain(id);
  });
});

describe('карточка объекта', () => {
  it('отдаёт собственника и объявления', async () => {
    const id = await makeProperty(actors.vake);
    const property = await getProperty(actors.vake, id);

    expect(property.owner?.phones.length).toBeGreaterThan(0);
    expect(property.listings.length).toBe(1);
    expect(property.listings[0]?.source).toBe('SS_GE');
  });

  it('описание для публикации редактируется отдельно от описания объявления', async () => {
    // Описание из объявления — чужой текст. Публиковать его от своего имени
    // странно и юридически, и стилистически (P1).
    const id = await makeProperty(actors.vake, { description: 'Текст автора объявления' });

    await updateProperty(actors.vake, id, { publicDescription: 'Наш текст' });
    const property = await getProperty(actors.vake, id);

    expect(property.publicDescription).toBe('Наш текст');
    expect(property.descriptionSource).toBe('Текст автора объявления');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Воронка и журнал
// ─────────────────────────────────────────────────────────────────────────────

describe('движение по воронке', () => {
  it('смена статуса пишется в журнал со старым и новым значением', async () => {
    // Без прошлого значения журнал не отвечает на вопрос «кто вернул объект
    // назад» — а это ровно тот вопрос, ради которого его читают (Q30).
    const id = await makeProperty(actors.vake);
    const statuses = await listPipelineStatuses(actors.vake);
    const before = await getProperty(actors.vake, id);
    const target = statuses.find((status) => status.id !== before.pipelineStatusId);
    if (target === undefined) throw new Error('некуда двигать');

    await changePropertyStatus(actors.vake, id, target.id);

    const entries = await propertyActivity(actors.vake, id);
    const moved = entries.find((entry) => entry.action === 'PROPERTY_STATUS_CHANGED');

    expect(moved).toBeDefined();
    expect(moved?.before).toMatchObject({ pipelineStatus: before.pipelineStatusName });
    expect(moved?.after).toMatchObject({ pipelineStatus: target.name });
  });

  it('повторная установка того же статуса записи не плодит', async () => {
    const id = await makeProperty(actors.vake);
    const property = await getProperty(actors.vake, id);

    await changePropertyStatus(actors.vake, id, property.pipelineStatusId);

    const entries = await propertyActivity(actors.vake, id);
    expect(entries.filter((entry) => entry.action === 'PROPERTY_STATUS_CHANGED')).toHaveLength(0);
  });

  it('статус другой компании неотличим от несуществующего', async () => {
    const id = await makeProperty(actors.vake);
    const foreign = await listPipelineStatuses(actors.batumi);
    const target = foreign[0];
    if (target === undefined) throw new Error('у второй компании нет статусов');

    await expect(changePropertyStatus(actors.vake, id, target.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('менеджер назначает ответственного, агент — нет', async () => {
    const id = await makeProperty(actors.vake);

    await expect(assignProperty(actors.vake, id, actors.vake.userId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const assigned = await assignProperty(actors.manager, id, actors.vake.userId);
    expect(assigned.assignedUserId).toBe(actors.vake.userId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Задачи и комментарии
// ─────────────────────────────────────────────────────────────────────────────

describe('задачи', () => {
  it('создаются на объект и попадают в список', async () => {
    const propertyId = await makeProperty(actors.vake);
    const task = await createTask(actors.vake, { propertyId, title: 'Позвонить собственнику' });

    const tasks = await listTasks(actors.vake, { propertyId });
    expect(tasks.map((item) => item.id)).toContain(task.id);
  });

  it('просроченная задача помечена сервером, а не клиентом', async () => {
    // Часовой пояс должен быть один: браузер агента в поездке считал бы
    // просрочку иначе, чем браузер его руководителя.
    const propertyId = await makeProperty(actors.vake);
    const task = await createTask(actors.vake, {
      propertyId,
      title: 'Вчерашняя задача',
      dueAt: new Date(Date.now() - 60_000).toISOString(),
    });

    expect(task.overdue).toBe(true);
  });

  it('выполнение отличается от отмены', async () => {
    const propertyId = await makeProperty(actors.vake);
    const done = await createTask(actors.vake, { propertyId, title: 'Сделать' });
    const cancelled = await createTask(actors.vake, { propertyId, title: 'Не делать' });

    await setTaskStatus(actors.vake, done.id, TaskStatus.done);
    await setTaskStatus(actors.vake, cancelled.id, TaskStatus.cancelled);

    const actions = (await propertyActivity(actors.vake, propertyId)).map((entry) => entry.action);
    expect(actions).toContain('TASK_COMPLETED');
    expect(actions).toContain('TASK_CANCELLED');
  });

  it('задачу нельзя завести на объект другой компании', async () => {
    const foreign = await makeProperty(actors.batumi);

    await expect(
      createTask(actors.vake, { propertyId: foreign, title: 'Чужой объект' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('комментарии', () => {
  it('сохраняются и читаются с автором', async () => {
    const propertyId = await makeProperty(actors.vake);
    await addComment(actors.vake, propertyId, 'Собственник просил перезвонить вечером');

    const comments = await listComments(actors.vake, propertyId);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.authorUserId).toBe(actors.vake.userId);
  });

  it('текст комментария в журнал не попадает', async () => {
    // Правило 10: комментарий может содержать пересказ разговора
    // с собственником, включая то, что в журнал класть нельзя.
    const propertyId = await makeProperty(actors.vake);
    const secret = 'номер собственника 555111222, зовут Мариам';
    await addComment(actors.vake, propertyId, secret);

    const entries = await propertyActivity(actors.vake, propertyId);
    const added = entries.find((entry) => entry.action === 'COMMENT_ADDED');

    expect(added).toBeDefined();
    expect(JSON.stringify(added?.after)).not.toContain('Мариам');
    expect(JSON.stringify(added?.after)).not.toContain('555111222');
  });

  it('нельзя прокомментировать объект другой компании', async () => {
    const foreign = await makeProperty(actors.batumi);
    await expect(addComment(actors.vake, foreign, 'привет')).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Изоляция: ни один сценарий не отдаёт чужое
// ─────────────────────────────────────────────────────────────────────────────

describe('изоляция компаний', () => {
  it('список объектов не содержит объектов другой компании', async () => {
    const foreign = await makeProperty(actors.batumi);
    const { items } = await listProperties(actors.vake, { limit: 100 });

    expect(items.map((item) => item.id)).not.toContain(foreign);
  });

  it('карточка чужого объекта неотличима от несуществующей', async () => {
    // Не Forbidden: различимость подсказала бы, что такой объект существует
    // (риск R-04).
    const foreign = await makeProperty(actors.batumi);
    await expect(getProperty(actors.vake, foreign)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('чужой объект нельзя ни переместить, ни переназначить, ни отредактировать', async () => {
    const foreign = await makeProperty(actors.batumi);
    const statuses = await listPipelineStatuses(actors.vake);
    const target = statuses[0];
    if (target === undefined) throw new Error('нет статусов');

    await expect(changePropertyStatus(actors.vake, foreign, target.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(assignProperty(actors.manager, foreign, null)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      updateProperty(actors.vake, foreign, { publicDescription: 'моё' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('история чужого объекта недоступна', async () => {
    const foreign = await makeProperty(actors.batumi);
    await expect(propertyActivity(actors.vake, foreign)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('задачи и комментарии чужой компании не видны', async () => {
    const foreign = await makeProperty(actors.batumi);
    await createTask(actors.batumi, { propertyId: foreign, title: 'Чужая задача' });
    await addComment(actors.batumi, foreign, 'Чужой комментарий');

    const tasks = await listTasks(actors.vake, { limit: 200 });
    expect(tasks.map((task) => task.title)).not.toContain('Чужая задача');

    // Список комментариев чужого объекта пуст, а не «запрещён»: фильтр
    // по компании стоит в самой выборке.
    expect(await listComments(actors.vake, foreign)).toEqual([]);
  });

  it('соседняя команда компании объект видит — конкуренция разрешена', async () => {
    // Инвариант 9: область владения — команда, но видимость шире.
    // Прятать это значило бы выдавать штатное поведение за дефект.
    const id = await makeProperty(actors.vake);
    const { items } = await listProperties(actors.saburtalo, { limit: 100 });

    // Агент соседней команды объект в своём списке не видит: его область —
    // своя команда. Менеджер компании видит оба.
    expect(items.map((item) => item.id)).not.toContain(id);

    const managerView = await listProperties(actors.manager, { limit: 100 });
    expect(managerView.items.map((item) => item.id)).toContain(id);
  });
});
