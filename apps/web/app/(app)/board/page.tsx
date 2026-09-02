import { listPipelineStatuses, listProperties } from '@kleekto/core';
import { translate } from '@kleekto/i18n';

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
        locale={locale}
        emptyLabel={translate(locale, 'board.empty')}
        columns={statuses.map((status) => ({ id: status.id, name: status.name }))}
        items={items.map((item) => ({
          id: item.id,
          pipelineStatusId: item.pipelineStatusId,
          propertyType: item.propertyType,
          transactionType: item.transactionType,
          rooms: item.rooms,
          areaTotal: item.areaTotal,
          floor: item.floor,
          totalFloors: item.totalFloors,
          district: item.district,
          addressRaw: item.addressRaw,
          price: item.price,
          currency: item.currency,
        }))}
      />
    </div>
  );
}
