import { type PipelineStatus, prisma } from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { NotFoundError, ValidationError } from '../errors';
import { requirePermission } from '../rbac/guard';

export interface PipelineStatusSummary {
  id: string;
  code: string;
  name: string;
  /**
   * Имя дано агентством, а не сидом.
   *
   * Экран показывает перевод по коду, пока имя не тронуто: у стадий из сида
   * оно английское, и грузинский агент видел бы «In base». Как только
   * агентство назвало стадию по-своему, побеждает его имя.
   */
  nameIsCustom: boolean;
  sortOrder: number;
  isSystem: boolean;
  colorToken: string | null;
}

function toSummary(status: PipelineStatus): PipelineStatusSummary {
  return {
    id: status.id,
    code: status.code,
    name: status.name,
    nameIsCustom: status.nameIsCustom,
    sortOrder: status.sortOrder,
    isSystem: status.isSystem,
    colorToken: status.colorToken,
  };
}

/**
 * Статусы воронки компании.
 *
 * Инвариант 4: читаются из базы, а не из константы в коде. Компания их
 * переименовывает и переупорядочивает под себя, и логика обязана обращаться
 * к статусу по коду, а не по позиции в списке.
 */
export async function listPipelineStatuses(ctx: AuthContext): Promise<PipelineStatusSummary[]> {
  requirePermission(ctx, 'pipelineStatus', 'read');

  const statuses = await prisma.pipelineStatus.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { sortOrder: 'asc' },
  });

  return statuses.map(toSummary);
}

/**
 * Цвета стадий — закрытый список, а не произвольная строка.
 *
 * Значение уходит в разметку доски. Пускать туда что угодно значило бы
 * позволить любому менеджеру вписать в страницу произвольный CSS; выбор
 * из пяти имён закрывает это и заодно держит доску в одной палитре.
 *
 * Пять статусов из сида были заведены с прежними именами токенов
 * (`brand-primary`, `text-secondary`). Они остаются в базе и на экране
 * читаются, но новыми значениями больше не становятся.
 */
export const STATUS_COLORS = ['brand', 'success', 'warning', 'danger', 'neutral'] as const;

export type StatusColor = (typeof STATUS_COLORS)[number];

function cleanColor(value: string): string {
  if (!STATUS_COLORS.includes(value as StatusColor)) {
    throw new ValidationError('Неизвестный цвет стадии', { fields: ['colorToken'] });
  }
  return value;
}

/** Шаг между соседними стадиями. Между 10 и 20 всегда есть куда вставить. */
const SORT_STEP = 10;

/** Длина имени стадии. Это заголовок колонки, а не описание процесса. */
const MAX_NAME = 60;

export interface CreatePipelineStatusInput {
  name: string;
  colorToken?: string | undefined;
}

/**
 * Код новой стадии.
 *
 * Код нужен не для показа, а как устойчивый ключ: он переживает
 * переименование, и по нему статус находит логика (инвариант 4). У стадий,
 * заведённых агентством, перевода нет и не будет — они показываются своим
 * именем, поэтому код может быть любым, лишь бы уникальным в компании
 * и узнаваемым в журнале.
 */
function customCode(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const salt = Math.random().toString(36).slice(2, 6).toUpperCase();
  return 'CUSTOM_' + stamp + salt;
}

function cleanName(raw: string): string {
  const name = raw.trim();

  if (name === '') {
    throw new ValidationError('Название стадии не может быть пустым', { fields: ['name'] });
  }
  if (name.length > MAX_NAME) {
    throw new ValidationError('Название длиннее ' + String(MAX_NAME) + ' символов', {
      fields: ['name'],
    });
  }

  return name;
}

/**
 * Новая стадия воронки.
 *
 * Встаёт в конец. Вставлять её в середину значило бы угадывать, куда
 * агентство хочет её поместить; порядок меняется отдельно, перетаскиванием
 * колонки.
 */
export async function createPipelineStatus(
  ctx: AuthContext,
  input: CreatePipelineStatusInput,
): Promise<PipelineStatusSummary> {
  requirePermission(ctx, 'pipelineStatus', 'create');

  const name = cleanName(input.name);

  const last = await prisma.pipelineStatus.findFirst({
    where: { companyId: ctx.companyId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    const status = await tx.pipelineStatus.create({
      data: {
        // companyId из контекста (правило 5).
        companyId: ctx.companyId,
        code: customCode(),
        name,
        // Заведена агентством — значит, имя своё и переводом не подменяется.
        nameIsCustom: true,
        sortOrder: (last?.sortOrder ?? 0) + SORT_STEP,
        isSystem: false,
        ...(input.colorToken === undefined ? {} : { colorToken: cleanColor(input.colorToken) }),
      },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PIPELINE_STATUS,
      entityId: status.id,
      action: ACTIVITY.PIPELINE_STATUS_CREATED,
      after: { code: status.code, name: status.name, sortOrder: status.sortOrder },
    });

    return status;
  });

  return toSummary(created);
}

export interface UpdatePipelineStatusInput {
  name?: string | undefined;
  colorToken?: string | null | undefined;
}

/**
 * Переименование стадии и смена её цвета.
 *
 * Переименовать можно и системную: `isSystem` защищает от удаления, а не от
 * собственного названия агентства. Код при этом не меняется — на нём держатся
 * переходы импорта и публикации, и переименование не должно их задевать.
 */
export async function updatePipelineStatus(
  ctx: AuthContext,
  statusId: string,
  input: UpdatePipelineStatusInput,
): Promise<PipelineStatusSummary> {
  requirePermission(ctx, 'pipelineStatus', 'update');

  const status = await prisma.pipelineStatus.findFirst({
    // companyId из контекста (правило 5): чужую воронку этим не достать.
    where: { id: statusId, companyId: ctx.companyId },
  });
  if (status === null) throw new NotFoundError('Стадия не найдена');

  const name = input.name === undefined ? undefined : cleanName(input.name);

  if (name === undefined && input.colorToken === undefined) {
    throw new ValidationError('Менять нечего: не передано ни одного поля');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.pipelineStatus.update({
      where: { id: statusId },
      data: {
        // Переименование поднимает флаг: иначе на экране осталось бы имя,
        // переведённое по коду, и правка была бы не видна.
        ...(name === undefined ? {} : { name, nameIsCustom: true }),
        ...(input.colorToken === undefined
          ? {}
          : { colorToken: input.colorToken === null ? null : cleanColor(input.colorToken) }),
      },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PIPELINE_STATUS,
      entityId: statusId,
      action: ACTIVITY.PIPELINE_STATUS_UPDATED,
      before: { name: status.name, colorToken: status.colorToken },
      after: { name: row.name, colorToken: row.colorToken },
    });

    return row;
  });

  return toSummary(updated);
}

/**
 * Удаление стадии.
 *
 * Две защиты, и обе не косметические.
 *
 * Системные стадии не удаляются: в `IN_BASE` объект встаёт по «Согласен»,
 * в `IN_PROGRESS` переходит по факту заполнения формы. Без них упали бы
 * импорт и публикация — причём не в момент удаления, а позже, у агента
 * посреди работы, и связать одно с другим было бы уже некому.
 *
 * Объекты внутри стадии не исчезают вместе с ней. Куда их девать — решает
 * человек: разложить их «куда-нибудь» молча значит переписать за него
 * историю воронки. Пока стадия не пуста и цель переноса не названа,
 * удаления не происходит.
 */
export async function deletePipelineStatus(
  ctx: AuthContext,
  statusId: string,
  options: { moveToStatusId?: string | undefined } = {},
): Promise<{ movedProperties: number }> {
  requirePermission(ctx, 'pipelineStatus', 'delete');

  const status = await prisma.pipelineStatus.findFirst({
    where: { id: statusId, companyId: ctx.companyId },
  });
  if (status === null) throw new NotFoundError('Стадия не найдена');

  if (status.isSystem) {
    throw new ValidationError(
      'Эту стадию удалить нельзя: на неё встают объекты при импорте и публикации',
      { fields: ['statusId'], reason: 'stage_is_system' },
    );
  }

  const occupied = await prisma.property.count({
    where: { pipelineStatusId: statusId, companyId: ctx.companyId },
  });

  const moveTo = options.moveToStatusId;

  if (occupied > 0) {
    if (moveTo === undefined) {
      throw new ValidationError(
        'В стадии ' + String(occupied) + ' объектов. Укажите, куда их перенести',
        { fields: ['moveToStatusId'], reason: 'stage_not_empty', count: occupied },
      );
    }
    if (moveTo === statusId) {
      throw new ValidationError('Переносить объекты в удаляемую стадию некуда', {
        fields: ['moveToStatusId'],
      });
    }

    const target = await prisma.pipelineStatus.findFirst({
      where: { id: moveTo, companyId: ctx.companyId },
      select: { id: true },
    });
    if (target === null) throw new NotFoundError('Стадия для переноса не найдена');
  }

  await prisma.$transaction(async (tx) => {
    if (occupied > 0 && moveTo !== undefined) {
      await tx.property.updateMany({
        where: { pipelineStatusId: statusId, companyId: ctx.companyId },
        data: { pipelineStatusId: moveTo },
      });
    }

    await tx.pipelineStatus.delete({ where: { id: statusId } });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PIPELINE_STATUS,
      entityId: statusId,
      action: ACTIVITY.PIPELINE_STATUS_DELETED,
      before: { code: status.code, name: status.name },
      after: { movedProperties: occupied, movedTo: moveTo ?? null },
    });
  });

  return { movedProperties: occupied };
}

/**
 * Новый порядок стадий.
 *
 * Принимается ВЕСЬ список целиком, а не «подвинь эту на одну влево».
 * Частичное перемещение пришлось бы согласовывать с тем, что видел браузер,
 * а видеть он мог уже устаревшую доску: две перестановки подряд дали бы
 * порядок, которого никто не просил.
 */
export async function reorderPipelineStatuses(
  ctx: AuthContext,
  orderedIds: readonly string[],
): Promise<PipelineStatusSummary[]> {
  requirePermission(ctx, 'pipelineStatus', 'update');

  const existing = await prisma.pipelineStatus.findMany({
    where: { companyId: ctx.companyId },
    select: { id: true },
  });

  const known = new Set(existing.map((status) => status.id));
  const given = new Set(orderedIds);

  if (given.size !== orderedIds.length) {
    throw new ValidationError('В новом порядке есть повторы', { fields: ['order'] });
  }

  // Список обязан совпадать с воронкой поштучно. Иначе стадия, заведённая
  // соседом секунду назад, порядка бы не получила и уехала в конец доски.
  if (given.size !== known.size || orderedIds.some((id) => !known.has(id))) {
    throw new ValidationError('Новый порядок не совпадает с воронкой компании', {
      fields: ['order'],
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.pipelineStatus.update({
        where: { id },
        data: { sortOrder: (index + 1) * SORT_STEP },
      });
    }

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PIPELINE_STATUS,
      // Перестановка — событие всей воронки, а не отдельной стадии.
      entityId: ctx.companyId,
      action: ACTIVITY.PIPELINE_STATUS_REORDERED,
      after: { count: orderedIds.length },
    });
  });

  return listPipelineStatuses(ctx);
}
