import {
  fileUrls,
  listPipelineStatuses,
  listProperties,
  listTeams,
  listUsers,
  permissionScope,
} from '@kleekto/core';
import { MARKET_UTC_OFFSET, translate } from '@kleekto/i18n';

import { factsLine, kindLine, placeLine, priceLine, statusLabel } from '../../_lib/format';
import { editLabels, factDictionaries } from '../../_lib/property-labels';
import { contextLocale, requireContext } from '../../_lib/session';
import { Board } from './board';
import { BoardFilters } from './filters';

/**
 * Доска по воронке — DESIGN §16.
 *
 * Колонки — это `PipelineStatus` компании, а не список в коде: набор статусов
 * редактируется агентством (инвариант 4). Захардкодить их значило бы сломать
 * доску первому же агентству, которое добавит свой этап.
 */
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);
  const params = await searchParams;

  const single = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === 'string' && value !== '' ? value : undefined;
  };

  /*
   * Дата из адреса — `ГГГГ-ММ-ДД`, ровно то, что отдаёт поле `date`.
   *
   * ГРАНИЦА СУТОК — ГРУЗИНСКАЯ, А НЕ СЕРВЕРНАЯ. Приложение живёт в облаке
   * по UTC, а агент — в Тбилиси, и разница ровно четыре часа приходится
   * на начало суток. Без явного смещения «заведён с 6 сентября» отбрасывал
   * бы всё, что завели шестого до четырёх утра, — и объект, который агент
   * помнит как сегодняшний, в выборку не попадал бы.
   *
   * Верхняя граница берётся концом дня: «по 6 сентября» человек понимает
   * как «включая шестое», а `2026-09-06` без времени — это полночь, то есть
   * весь день оказался бы за границей.
   */
  const boundary = (raw: string | undefined, time: string): Date | undefined => {
    if (raw === undefined) return undefined;
    const parsed = new Date(`${raw}T${time}${MARKET_UTC_OFFSET}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };
  const dateFrom = (raw: string | undefined): Date | undefined => boundary(raw, '00:00:00.000');
  const dateTo = (raw: string | undefined): Date | undefined => boundary(raw, '23:59:59.999');

  // Правило 6: кнопка правки прячется у того, кому сервер откажет.
  const canEdit = permissionScope(ctx.role, 'property', 'update') !== null;
  // Списки для фильтров запрашиваются, только если человеку положено:
  // обращение за списком без права вернуло бы отказ и уронило бы доску.
  const canListPeople = permissionScope(ctx.role, 'user', 'read') !== null;
  const canListTeams = permissionScope(ctx.role, 'team', 'read') !== null;

  const [statuses, { items }, people, teams] = await Promise.all([
    listPipelineStatuses(ctx),
    listProperties(ctx, {
      limit: 100,
      query: single('query'),
      assignedUserId: single('agent'),
      teamId: single('team'),
      createdFrom: dateFrom(single('from')),
      createdTo: dateTo(single('to')),
    }),
    canListPeople ? listUsers(ctx) : Promise.resolve([]),
    canListTeams ? listTeams(ctx) : Promise.resolve([]),
  ]);

  /*
   * Обложки и лица подписываются на сервере, все сразу: бак приватный,
   * постоянного адреса у файла нет. Лица — по УНИКАЛЬНЫМ ключам: у одного
   * агента на доске легко десять карточек.
   */
  const photoUrls = await fileUrls(
    ctx,
    items.map((item) => item.photo ?? ''),
  );
  const photoOf = new Map(items.map((item, index) => [item.id, photoUrls[index] ?? null]));

  const faceKeys = [
    ...new Set(items.map((item) => item.assignedUserAvatarKey).filter((key) => key !== null)),
  ];
  const faceUrls = await fileUrls(ctx, faceKeys);
  const faceOf = new Map(faceKeys.map((key, index) => [key, faceUrls[index] ?? null]));

  // Настройка воронки — право руководителя. Проверяется по матрице, а не по
  // списку ролей: право отзовут в матрице, а выписанный здесь заново список
  // останется и поведёт человека в отказ.
  const canManage = permissionScope(ctx.role, 'pipelineStatus', 'update') !== null;

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('board.title')}</h1>

      <BoardFilters
        labels={{
          search: t('property.search'),
          allPeople: t('board.allPeople'),
          allTeams: t('board.allTeams'),
          from: t('board.dateFrom'),
          to: t('board.dateTo'),
          reset: t('property.reset'),
        }}
        people={people
          .filter((person) => person.isActive)
          .map((person) => ({ id: person.id, name: person.fullName }))}
        teams={teams.map((team) => ({ id: team.id, name: team.name }))}
      />

      <Board
        canManage={canManage}
        columns={statuses.map((status) => ({
          id: status.id,
          // Название переводится по коду: имя в базе английское, его туда
          // положила регистрация, когда язык компании ещё не был известен.
          // Переименованная агентством стадия показывается своим именем.
          name: statusLabel(locale, status),
          fallbackName: status.name,
          names: status.names,
          colorToken: status.colorToken,
          isSystem: status.isSystem,
        }))}
        items={items.map((item) => ({
          id: item.id,
          pipelineStatusId: item.pipelineStatusId,
          // Строки собираются здесь, на сервере: внутри `Intl`, а у браузера
          // может не быть данных нужной локали — см. `board.tsx`.
          price: priceLine(locale, item),
          kind: kindLine(locale, item),
          facts: factsLine(locale, item),
          place: placeLine(item),
          photo: photoOf.get(item.id) ?? null,
          agentName: item.assignedUserName,
          agentAvatar:
            item.assignedUserAvatarKey === null
              ? null
              : (faceOf.get(item.assignedUserAvatarKey) ?? null),
          isExclusive: item.isExclusive,
        }))}
        edit={
          canEdit
            ? {
                labels: editLabels(locale),
                dictionaries: factDictionaries(locale),
              }
            : null
        }
        labels={{
          empty: t('board.empty'),
          photoAlt: t('property.photoAlt'),
          unassigned: t('property.unassigned'),
          exclusive: t('property.exclusive'),
          manage: t('board.manage'),
          addStage: t('board.addStage'),
          stageName: t('board.stageName'),
          localeNames: LOCALE_NAMES,
          rename: t('board.rename'),
          color: t('board.color'),
          deleteStage: t('board.deleteStage'),
          moveTo: t('board.moveTo'),
          occupied: t('board.occupied'),
          systemStage: t('board.systemStage'),
          confirm: t('board.confirmDelete'),
          save: t('common.save'),
          cancel: t('common.cancel'),
          saving: t('common.loading'),
          failed: t('board.failed'),
          moveFailed: t('board.moveFailed'),
          orderFailed: t('board.orderFailed'),
          reasons: {
            stage_is_system: t('board.stageIsSystem'),
            stage_not_empty: t('board.stageNotEmpty'),
          },
          colors: {
            brand: t('board.colors.brand'),
            success: t('board.colors.success'),
            warning: t('board.colors.warning'),
            danger: t('board.colors.danger'),
            neutral: t('board.colors.neutral'),
          },
        }}
      />
    </div>
  );
}

/**
 * Подписи языков у полей имени стадии — каждая на своём языке.
 *
 * Не переводятся: человек ищет глазами «ქართული», а не «грузинский»,
 * на каком бы языке ни был остальной интерфейс. Тот же приём, что
 * в переключателе языка.
 */
const LOCALE_NAMES: Record<string, string> = {
  ka: 'ქართული',
  en: 'English',
  ru: 'Русский',
};
