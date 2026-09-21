import { selectTestDatabase } from './test-database-target';

/** Точка входа `pnpm db:seed`. */
async function main(): Promise<void> {
  selectTestDatabase();

  // Prisma загружается только после fail-closed проверки destructive target.
  const [{ prisma }, { seed }] = await Promise.all([import('@kleekto/db'), import('./seed')]);

  try {
    const result = await seed();

    console.warn('База заполнена тестовыми данными:');
    for (const company of result.companies) {
      console.warn(`  ${company.name}: команд ${company.teams}, пользователей ${company.users}`);
    }
    console.warn(`\nПароль у всех: ${result.password}`);
    console.warn('Две компании — чтобы негативные тесты изоляции проверяли реальные данные.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
