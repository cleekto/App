import { listPipelineStatuses, listProperties, permissionScope } from '@kleekto/core';
import { translate } from '@kleekto/i18n';

import { factsLine, kindLine, placeLine, priceLine, statusLabel } from '../../_lib/format';
import { contextLocale, requireContext } from '../../_lib/session';
import { Board } from './board';

/**
 * Доска по воронке — DESIGN §16.
 *
 * Колонки — это `PipelineStatus` компании, а не список в коде: набор статусов
 * редактируется агентством (инвариант 4). Захардкодить их значило бы сломать
 * доску первому же агентству, которое добавит свой этап.
 */
export default async function BoardPage() {
  const ctx = await requireContext();
  const locale = contextLocale(ctx);

  const [statuses, { items }] = await Promise.all([
    listPipelineStatuses(ctx),
    listProperties(ctx, { limit: 100 }),
  ]);

  // Настройка воронки — право руководителя. Проверяется по матрице, а не по
  // списку ролей: право отзовут в матрице, а выписанный здесь заново список
  // останется и поведёт человека в отказ.
  const canManage = permissionScope(ctx.role, 'pipelineStatus', 'update') !== null;

  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('board.title')}</h1>

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
        }))}
        labels={{
          empty: t('board.empty'),
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
