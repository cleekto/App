import { prisma } from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { assertScope, requirePermission } from '../rbac/guard';
import { permissionScope } from '../rbac/permissions';

/**
 * Чат компании и личная переписка.
 *
 * ЧТО ЗДЕСЬ РЕШЕНО ВЛАДЕЛЬЦЕМ (2026-09-05), а не выведено из кода:
 *   — комнаты открыты всей компании, закрытых нет;
 *   — создают комнаты администратор и менеджер, пишет каждый;
 *   — личная переписка не выходит за границу компании;
 *   — автор удаляет своё, администратор — любое.
 *
 * ГРАНИЦА КОМПАНИИ ЖЁСТКАЯ И ЗДЕСЬ. `companyId` берётся только из контекста
 * (правило 5), и каждый запрос ограничен им — включая поиск собеседника:
 * написать человеку из чужого агентства нельзя, и это не «маловероятно»,
 * а невозможно.
 */

const MAX_BODY = 4000;
const MAX_NAME = 80;

export interface ChatRoomSummary {
  id: string;
  name: string;
  topic: string | null;
  isArchived: boolean;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface ChatMessageView {
  id: string;
  body: string | null;
  authorUserId: string;
  authorName: string;
  createdAt: string;
  editedAt: string | null;
  isDeleted: boolean;
  /** Может ли ТЕКУЩИЙ пользователь удалить это сообщение. */
  canDelete: boolean;
  /** Правит только автор — и только пока сообщение не удалено. */
  canEdit: boolean;
}

export interface DirectConversationSummary {
  id: string;
  partnerUserId: string;
  partnerName: string;
  lastMessageAt: string | null;
}

// ── Комнаты ──────────────────────────────────────────────────────────────────

export async function listChatRooms(
  ctx: AuthContext,
  options: { includeArchived?: boolean } = {},
): Promise<ChatRoomSummary[]> {
  requirePermission(ctx, 'chatRoom', 'read');

  const rooms = await prisma.chatRoom.findMany({
    where: {
      companyId: ctx.companyId,
      ...(options.includeArchived === true ? {} : { isArchived: false }),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { messages: true } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return rooms.map((room) => ({
    id: room.id,
    name: room.name,
    topic: room.topic,
    isArchived: room.isArchived,
    messageCount: room._count.messages,
    lastMessageAt: room.messages[0]?.createdAt.toISOString() ?? null,
  }));
}

export async function createChatRoom(
  ctx: AuthContext,
  input: { name: string; topic?: string | null | undefined },
): Promise<{ id: string }> {
  const scope = requirePermission(ctx, 'chatRoom', 'create');
  assertScope(ctx, scope, { companyId: ctx.companyId, teamId: null });

  const name = input.name.trim();
  if (name === '' || name.length > MAX_NAME) {
    throw new ValidationError('Нужно название комнаты', { fields: ['name'] });
  }

  const topic = input.topic?.trim();

  const room = await prisma.chatRoom.create({
    data: {
      companyId: ctx.companyId,
      name,
      topic: topic === undefined || topic === '' ? null : topic,
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  });

  await writeActivity(prisma, ctx, {
    entityType: ENTITY.CHAT_ROOM,
    entityId: room.id,
    action: ACTIVITY.CHAT_ROOM_CREATED,
    after: { name },
  });

  return room;
}

export async function updateChatRoom(
  ctx: AuthContext,
  roomId: string,
  input: { name?: string | undefined; topic?: string | null | undefined; isArchived?: boolean },
): Promise<{ id: string }> {
  const scope = requirePermission(ctx, 'chatRoom', 'update');

  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, companyId: ctx.companyId },
    select: { id: true, companyId: true, name: true },
  });
  if (room === null) throw new NotFoundError();

  assertScope(ctx, scope, { companyId: room.companyId, teamId: null });

  const name = input.name?.trim();
  if (name !== undefined && (name === '' || name.length > MAX_NAME)) {
    throw new ValidationError('Нужно название комнаты', { fields: ['name'] });
  }

  const topic = input.topic?.trim();

  await prisma.chatRoom.update({
    where: { id: room.id },
    data: {
      ...(name === undefined ? {} : { name }),
      ...(input.topic === undefined ? {} : { topic: topic === '' ? null : (topic ?? null) }),
      ...(input.isArchived === undefined ? {} : { isArchived: input.isArchived }),
    },
  });

  await writeActivity(prisma, ctx, {
    entityType: ENTITY.CHAT_ROOM,
    entityId: room.id,
    action: ACTIVITY.CHAT_ROOM_UPDATED,
    before: { name: room.name },
    after: { name: name ?? room.name, isArchived: input.isArchived },
  });

  return { id: room.id };
}

// ── Личная переписка ─────────────────────────────────────────────────────────

/**
 * Переписка с конкретным человеком — существующая либо новая.
 *
 * Пара нормализуется сортировкой идентификаторов: иначе одни и те же двое
 * заводили бы две переписки, по одной на того, кто написал первым, и половина
 * сообщений оказывалась бы «в другой». То же условие держит и база.
 */
export async function openDirectConversation(
  ctx: AuthContext,
  partnerUserId: string,
): Promise<{ id: string; partnerUserId: string; partnerName: string }> {
  if (partnerUserId === ctx.userId) {
    throw new ValidationError('Нельзя написать самому себе', { fields: ['partnerUserId'] });
  }

  // Собеседник ищется В ГРАНИЦАХ КОМПАНИИ. Это и есть изоляция арендаторов:
  // человек из другого агентства просто не находится, а не «находится,
  // но потом отказ».
  const partner = await prisma.user.findFirst({
    where: { id: partnerUserId, companyId: ctx.companyId, isActive: true },
    select: { id: true, fullName: true },
  });
  if (partner === null) throw new NotFoundError();

  const [userAId, userBId] = [ctx.userId, partner.id].sort();
  if (userAId === undefined || userBId === undefined) throw new NotFoundError();

  const conversation = await prisma.directConversation.upsert({
    where: { companyId_userAId_userBId: { companyId: ctx.companyId, userAId, userBId } },
    create: { companyId: ctx.companyId, userAId, userBId },
    update: {},
    select: { id: true },
  });

  return { id: conversation.id, partnerUserId: partner.id, partnerName: partner.fullName };
}

export async function listDirectConversations(
  ctx: AuthContext,
): Promise<DirectConversationSummary[]> {
  const conversations = await prisma.directConversation.findMany({
    where: {
      companyId: ctx.companyId,
      OR: [{ userAId: ctx.userId }, { userBId: ctx.userId }],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const partnerIds = conversations.map((row) =>
    row.userAId === ctx.userId ? row.userBId : row.userAId,
  );

  const partners = await prisma.user.findMany({
    where: { id: { in: partnerIds }, companyId: ctx.companyId },
    select: { id: true, fullName: true },
  });
  const names = new Map(partners.map((user) => [user.id, user.fullName]));

  return conversations.map((row) => {
    const partnerUserId = row.userAId === ctx.userId ? row.userBId : row.userAId;

    return {
      id: row.id,
      partnerUserId,
      partnerName: names.get(partnerUserId) ?? '',
      lastMessageAt: row.messages[0]?.createdAt.toISOString() ?? null,
    };
  });
}

// ── Сообщения ────────────────────────────────────────────────────────────────

/**
 * Проверяет, что цель принадлежит компании и доступна этому человеку.
 *
 * У комнаты доступ общефирменный, у переписки — только участникам. Разница
 * принципиальная: комнату видят все, чужую переписку не видит никто, включая
 * администратора. Читать личные сообщения сотрудников — не право роли,
 * а слежка, и такой возможности в продукте нет.
 */
async function assertTarget(
  ctx: AuthContext,
  target: { roomId?: string | undefined; conversationId?: string | undefined },
): Promise<{ roomId: string | null; conversationId: string | null }> {
  const roomId = target.roomId;
  const conversationId = target.conversationId;

  if ((roomId === undefined) === (conversationId === undefined)) {
    throw new ValidationError('Нужна ровно одна цель: комната либо переписка');
  }

  if (roomId !== undefined) {
    const room = await prisma.chatRoom.findFirst({
      where: { id: roomId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (room === null) throw new NotFoundError();

    return { roomId: room.id, conversationId: null };
  }

  // Проверка «одна цель из двух» выше это уже гарантирует, но компилятор
  // через неё не видит, а `undefined` в условии выборки означал бы «любая
  // переписка» — то есть чужую.
  if (conversationId === undefined) {
    throw new ValidationError('Нужна ровно одна цель: комната либо переписка');
  }

  const conversation = await prisma.directConversation.findFirst({
    where: {
      id: conversationId,
      companyId: ctx.companyId,
      OR: [{ userAId: ctx.userId }, { userBId: ctx.userId }],
    },
    select: { id: true },
  });
  if (conversation === null) throw new NotFoundError();

  return { roomId: null, conversationId: conversation.id };
}

export async function listChatMessages(
  ctx: AuthContext,
  target: { roomId?: string | undefined; conversationId?: string | undefined },
  options: { limit?: number } = {},
): Promise<ChatMessageView[]> {
  requirePermission(ctx, 'chatMessage', 'read');
  const where = await assertTarget(ctx, target);

  const canDeleteAny = canDeleteOthers(ctx);

  const messages = await prisma.chatMessage.findMany({
    where: {
      companyId: ctx.companyId,
      ...(where.roomId === null
        ? { conversationId: where.conversationId }
        : { roomId: where.roomId }),
    },
    orderBy: { createdAt: 'asc' },
    take: Math.min(options.limit ?? 200, 500),
  });

  const authors = await prisma.user.findMany({
    where: { id: { in: [...new Set(messages.map((row) => row.authorUserId))] } },
    select: { id: true, fullName: true },
  });
  const names = new Map(authors.map((user) => [user.id, user.fullName]));

  return messages.map((message) => {
    const isDeleted = message.deletedAt !== null;
    const isAuthor = message.authorUserId === ctx.userId;

    return {
      id: message.id,
      // Текст удалённого не отдаётся вовсе. Прятать его на экране мало:
      // он всё равно уехал бы в браузер и лежал бы в ответе сервера.
      body: isDeleted ? null : message.body,
      authorUserId: message.authorUserId,
      authorName: names.get(message.authorUserId) ?? '',
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt?.toISOString() ?? null,
      isDeleted,
      canDelete: !isDeleted && (isAuthor || canDeleteAny),
      canEdit: !isDeleted && isAuthor,
    };
  });
}

export async function postChatMessage(
  ctx: AuthContext,
  target: { roomId?: string | undefined; conversationId?: string | undefined },
  body: string,
): Promise<{ id: string }> {
  requirePermission(ctx, 'chatMessage', 'create');

  const text = body.trim();
  if (text === '') throw new ValidationError('Пустое сообщение', { fields: ['body'] });
  if (text.length > MAX_BODY) {
    throw new ValidationError('Слишком длинное сообщение', { fields: ['body'] });
  }

  const where = await assertTarget(ctx, target);

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: {
        companyId: ctx.companyId,
        roomId: where.roomId,
        conversationId: where.conversationId,
        authorUserId: ctx.userId,
        body: text,
      },
      select: { id: true },
    });

    // Время последнего сообщения — то, по чему сортируется список комнат
    // и переписок. Без этого свежая переписка тонула бы внизу.
    if (where.roomId !== null) {
      await tx.chatRoom.update({ where: { id: where.roomId }, data: { updatedAt: new Date() } });
    } else if (where.conversationId !== null) {
      await tx.directConversation.update({
        where: { id: where.conversationId },
        data: { updatedAt: new Date() },
      });
    }

    return created;
  });

  return message;
}

export async function editChatMessage(
  ctx: AuthContext,
  messageId: string,
  body: string,
): Promise<{ id: string }> {
  requirePermission(ctx, 'chatMessage', 'update');

  const text = body.trim();
  if (text === '') throw new ValidationError('Пустое сообщение', { fields: ['body'] });

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, companyId: ctx.companyId },
    select: { id: true, authorUserId: true, deletedAt: true },
  });
  if (message === null) throw new NotFoundError();

  // ПРАВИТ ТОЛЬКО АВТОР, и администратор тут не исключение: приписать
  // коллеге слова, которых он не говорил, не должен никто.
  if (message.authorUserId !== ctx.userId) throw new ForbiddenError('Править можно только своё');
  if (message.deletedAt !== null) throw new NotFoundError();

  await prisma.chatMessage.update({
    where: { id: message.id },
    data: { body: text, editedAt: new Date() },
  });

  return { id: message.id };
}

export async function deleteChatMessage(
  ctx: AuthContext,
  messageId: string,
): Promise<{ id: string }> {
  requirePermission(ctx, 'chatMessage', 'delete');

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, companyId: ctx.companyId },
    select: { id: true, authorUserId: true, deletedAt: true, conversationId: true },
  });
  if (message === null) throw new NotFoundError();

  const isAuthor = message.authorUserId === ctx.userId;

  /*
   * Администратор удаляет любое сообщение В КОМНАТЕ — решение владельца.
   * В личной переписке чужое сообщение ему не отдаётся и удалить его нельзя:
   * туда он не имеет доступа вовсе, и «удалить не читая» — не право,
   * а способ обойти это ограничение.
   */
  const canDeleteAny = canDeleteOthers(ctx) && message.conversationId === null;

  if (!isAuthor && !canDeleteAny) {
    throw new ForbiddenError('Удалять можно только своё');
  }

  if (message.deletedAt === null) {
    await prisma.chatMessage.update({
      where: { id: message.id },
      data: { deletedAt: new Date(), body: '' },
    });

    await writeActivity(prisma, ctx, {
      entityType: ENTITY.CHAT_MESSAGE,
      entityId: message.id,
      action: ACTIVITY.CHAT_MESSAGE_DELETED,
      after: { byAuthor: isAuthor },
    });
  }

  return { id: message.id };
}

/**
 * Есть ли у роли право удалять ЧУЖИЕ сообщения.
 *
 * `permissionScope`, а не `requirePermission` в `try`: первый и создан
 * отвечать на вопрос «можно ли», второй — прерывать, когда нельзя. Ловить
 * собственное исключение ради проверки — способ спрятать ошибку, которая
 * когда-нибудь окажется другой.
 */
function canDeleteOthers(ctx: AuthContext): boolean {
  return permissionScope(ctx.role, 'chatMessage', 'delete') === 'company';
}
