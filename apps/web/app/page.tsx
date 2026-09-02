import { redirect } from 'next/navigation';

import { optionalContext } from './_lib/session';

/**
 * Корень.
 *
 * Витрины у продукта нет: kleekTo — рабочий инструмент, и человек, открывший
 * его адрес, идёт работать, а не читать про него. Отсюда только два пути —
 * в список объектов или на вход.
 */
export default async function RootPage() {
  const ctx = await optionalContext();
  redirect(ctx === null ? '/login' : '/properties');
}
