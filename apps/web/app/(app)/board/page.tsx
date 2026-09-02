import { listPipelineStatuses, listProperties } from '@kleekto/core';
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{translate(locale, 'board.title')}</h1>

      <Board
        emptyLabel={translate(locale, 'board.empty')}
        columns={statuses.map((status) => ({
          id: status.id,
          // Название переводится по коду: имя в базе английское, его туда
          // положила регистрация, когда язык компании ещё не был известен.
          name: statusLabel(locale, status),
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
      />
    </div>
  );
}
