import { afterAll, describe, expect, it } from 'vitest';

import { checkDatabase, prisma } from './index';

/**
 * Живая база. Запуск: `pnpm db:up && pnpm db:migrate && pnpm test:integration`.
 *
 * Тест намеренно не подменяет Prisma заглушкой: проверка, что мок вернул мок,
 * тестом не считается (промпт §7). Здесь проверяется, что миграция применилась
 * на настоящем PostgreSQL и расширения на месте.
 */
afterAll(async () => {
  await prisma.$disconnect();
});

describe('подключение к базе', () => {
  it('health-проверка выполняет реальный запрос', async () => {
    const result = await checkDatabase();

    expect(result.up).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('первая миграция применена', async () => {
    const rows = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null }>
    >`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at`;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.finished_at !== null)).toBe(true);
  });

  // Оба расширения нужны конкретным требованиям, а не «на всякий случай»:
  // pg_trgm  — нечёткое сравнение адресов, дедупликация 4 уровня;
  // pgcrypto — gen_random_uuid() для первичных ключей.
  it.each(['pg_trgm', 'pgcrypto'])('расширение %s установлено', async (name) => {
    const rows = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = ${name}
    `;

    expect(rows).toHaveLength(1);
  });

  it('триграммное сравнение действительно работает', async () => {
    // Не «расширение числится установленным», а «функция считает».
    // Дедупликация 4 уровня стоит именно на этом.
    const rows = await prisma.$queryRaw<Array<{ similarity: number }>>`
      SELECT similarity('Сабуртало, ул. Вашлованская 12',
                        'сабуртало ул вашлованская 12') AS similarity
    `;

    expect(rows[0]?.similarity).toBeGreaterThan(0.5);
  });
});
