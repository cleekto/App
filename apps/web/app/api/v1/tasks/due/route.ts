import { listTasks } from '@kleekto/core';

import { handle, requireAuth } from '../../../_lib/handler';

export const dynamic = 'force-dynamic';

/**
 * Сколько задач горит прямо сейчас.
 *
 * ОТДЕЛЬНЫЙ МАРШРУТ НУЖЕН ПО ТОЙ ЖЕ ПРИЧИНЕ, ЧТО И У НЕПРОЧИТАННОГО:
 * оболочка приложения серверная и между переходами не перерисовывается.
 * Посчитанное при загрузке число застыло бы до следующей полной загрузки,
 * и напоминание, наступившее в три часа дня, человек увидел бы завтра утром.
 *
 * Считаются просроченные и сегодняшние: задача со сроком через неделю —
 * не напоминание, а план, и мигать из-за неё нечему.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const ctx = await requireAuth(request);

    /*
     * Конец сегодняшнего дня ПО ВРЕМЕНИ РЫНКА. «Сегодня» у агента
     * грузинское, а сервер в облаке живёт по UTC: без сдвига задача,
     * назначенная на вечер, весь день считалась бы завтрашней.
     */
    const now = new Date();
    const tbilisi = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const endOfDay = new Date(
      Date.UTC(
        tbilisi.getUTCFullYear(),
        tbilisi.getUTCMonth(),
        tbilisi.getUTCDate(),
        23,
        59,
        59,
        999,
      ) -
        4 * 60 * 60 * 1000,
    );

    const tasks = await listTasks(ctx, {
      mine: true,
      status: 'open',
      dueBefore: endOfDay.toISOString(),
      limit: 200,
    });

    return { due: tasks.length, overdue: tasks.filter((task) => task.overdue).length };
  });
}
