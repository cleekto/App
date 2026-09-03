import { prisma } from '@kleekto/db';

import { ACTIVITY, ENTITY } from '../activity/actions';
import { writeActivity } from '../activity/write';
import type { AuthContext } from '../auth/context';
import { NotFoundError, ValidationError } from '../errors';
import { maskPhone, normalizePhone } from '../phone';
import { requirePermission } from '../rbac/guard';

/**
 * Профили публикации — лицо агентства в публичном объявлении (I13).
 *
 * Область у всех операций — компания, не команда. Это не упущение: телефоны
 * профилей участвуют в двух проверках уровня компании — исключении из
 * дедупликации по телефону (I20) и признаке самоимпорта (Q31). Команда,
 * не знающая о профиле соседней команды, получила бы ложные совпадения
 * по номеру собственного агентства (ADR-0006).
 */

export interface PublishProfileSummary {
  id: string;
  displayName: string;
  phone: string;
  userId: string | null;
  isDefault: boolean;
}

export interface CreatePublishProfileInput {
  displayName: string;
  phone: string;
  /** Заполнен — личный профиль агента; пуст — общий профиль компании. */
  userId?: string | null | undefined;
  isDefault?: boolean | undefined;
}

export async function createPublishProfile(
  ctx: AuthContext,
  input: CreatePublishProfileInput,
): Promise<PublishProfileSummary> {
  requirePermission(ctx, 'publishProfile', 'create');

  const displayName = input.displayName.trim();
  if (displayName === '') {
    throw new ValidationError('Имя в объявлении не указано', { fields: ['displayName'] });
  }

  const phone = normalizePhone(input.phone);

  if (input.userId !== null && input.userId !== undefined) {
    // Пользователь обязан быть из своей компании: иначе через userId можно
    // было бы привязать профиль к чужому сотруднику.
    const user = await prisma.user.findFirst({
      where: { id: input.userId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (user === null) {
      throw new NotFoundError('Пользователь не найден');
    }
  }

  const profile = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      // Профиль по умолчанию один: заполнение идёт им без диалога (P4),
      // и «первый попавшийся из двух» — это лицо агентства наугад.
      await tx.publishProfile.updateMany({
        where: { companyId: ctx.companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await tx.publishProfile.create({
      data: {
        companyId: ctx.companyId,
        userId: input.userId ?? null,
        displayName,
        phoneOriginal: phone.original,
        phoneNormalized: phone.normalized,
        isDefault: input.isDefault ?? false,
      },
    });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PUBLISH_PROFILE,
      entityId: created.id,
      action: ACTIVITY.PUBLISH_PROFILE_CREATED,
      // Номер в журнал попадает маской (правило 10).
      after: { displayName, phone: maskPhone(phone.normalized) },
    });

    return created;
  });

  return toSummary(profile);
}

/**
 * Профили компании — настройка агентства, а не рабочий инструмент агента.
 *
 * Агент этот список НЕ читает (решение владельца 2026-09-03): от чьего имени
 * уходит объявление, он видит в черновике публикации и в отчёте о заполнении,
 * а сам профиль подставляет сервер по праву `apply`.
 */
export async function listPublishProfiles(ctx: AuthContext): Promise<PublishProfileSummary[]> {
  requirePermission(ctx, 'publishProfile', 'read');

  const profiles = await prisma.publishProfile.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  return profiles.map(toSummary);
}

export async function deletePublishProfile(ctx: AuthContext, profileId: string): Promise<void> {
  requirePermission(ctx, 'publishProfile', 'delete');

  const profile = await prisma.publishProfile.findFirst({
    where: { id: profileId, companyId: ctx.companyId },
    select: { id: true, displayName: true },
  });

  if (profile === null) {
    throw new NotFoundError();
  }

  await prisma.$transaction(async (tx) => {
    await tx.publishProfile.delete({ where: { id: profileId } });

    await writeActivity(tx, ctx, {
      entityType: ENTITY.PUBLISH_PROFILE,
      entityId: profileId,
      action: ACTIVITY.PUBLISH_PROFILE_DELETED,
      before: { displayName: profile.displayName },
    });
  });
}

function toSummary(profile: {
  id: string;
  displayName: string;
  phoneOriginal: string;
  userId: string | null;
  isDefault: boolean;
}): PublishProfileSummary {
  return {
    id: profile.id,
    displayName: profile.displayName,
    // Номер агентства предназначен для публикации — он не тайна, в отличие
    // от телефона собственника, и показывается как есть.
    phone: profile.phoneOriginal,
    userId: profile.userId,
    isDefault: profile.isDefault,
  };
}
