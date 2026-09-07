import { NotFoundError, runCollector } from '@kleekto/core';

import { collectorSources } from '../../../../_lib/collector-sources';
import { handle } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Долгий маршрут: обращения к площадкам идут по одному и с паузами.
 *
 * Спешить сборщику некуда, а торопливость видна площадке. Предел взят
 * с запасом на самый медленный прогон, а не на обычный.
 */
export const maxDuration = 300;

/**
 * POST /api/v1/collector/run — фоновое наполнение ленты.
 *
 * ЗАПУСКАЕТСЯ ПО РАСПИСАНИЮ, НЕ ЧЕЛОВЕКОМ. Агент утром включает компьютер,
 * открывает kleekTo и видит обновлённую ленту — не заходя ни на одну
 * площадку и не включая расширение. Ради этого маршрут и существует.
 *
 * СЕССИИ ЗДЕСЬ НЕТ И НЕ ДОЛЖНО БЫТЬ. У ночного запуска нет пользователя,
 * и заводить ему учётную запись значило бы поселить в системе ложного
 * «сотрудника», от чьего имени что-то происходит. Вход закрыт общим
 * секретом (`CRON_SECRET`), который знает только планировщик.
 *
 * ПРАВИЛО 5 НЕЧЕМУ НАРУШИТЬ: индекс объявлений не принадлежит никакой
 * компании, колонки `companyId` в нём нет вовсе. Ни объектов, ни телефонов
 * этот маршрут не создаёт — только пополняет справочный индекс (инвариант 17).
 */
export async function POST(request: Request) {
  return handle(async () => {
    requireScheduler(request);
    return runCollector(collectorSources());
  });
}

/*
 * Расписание вызывает маршрут запросом GET — принимаем оба глагола, чтобы
 * прогон можно было запустить и вручную, и планировщиком.
 */
export async function GET(request: Request) {
  return POST(request);
}

/**
 * Секрет планировщика.
 *
 * Отвечаем 404, а не 401: снаружи не должно быть видно даже того, что такой
 * маршрут существует. Тот же приём, что и с чужой компанией.
 */
function requireScheduler(request: Request): void {
  const secret = process.env['CRON_SECRET'];

  // Секрет не задан — маршрута нет. Открытый сборщик хуже отсутствующего:
  // его дёргали бы кто угодно и сколько угодно, и площадка увидела бы это.
  if (secret === undefined || secret === '') throw new NotFoundError();

  const header = request.headers.get('authorization');
  if (header !== `Bearer ${secret}`) throw new NotFoundError();
}
