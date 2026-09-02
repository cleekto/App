import { prisma } from '@kleekto/db';

import { seed } from './seed';

/** Точка входа `pnpm db:seed`. */
async function main(): Promise<void> {
  const result = await seed();

  console.warn('База заполнена тестовыми данными:');
  for (const company of result.companies) {
    console.warn(`  ${company.name}: команд ${company.teams}, пользователей ${company.users}`);
  }
  console.warn(`\nПароль у всех: ${result.password}`);
  console.warn('Две компании — чтобы негативные тесты изоляции проверяли реальные данные.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
