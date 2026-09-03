/**
 * Причина отказа сервера — на языке человека.
 *
 * ПОЧЕМУ НЕ ПОКАЗАТЬ СООБЩЕНИЕ СЕРВЕРА НАПРЯМУЮ. Оно русское: ядро о языках
 * не знает и знать не должно (ADR-0001), а у агента интерфейс может быть
 * грузинским. Поэтому сценарий кладёт в детали ошибки машинный признак
 * причины, а текст к нему подбирается здесь, из словаря.
 *
 * Признака нет — остаётся общая фраза. Это не поломка: большинство отказов
 * объяснять нечем, и «не удалось сохранить» для них честнее выдуманной
 * подробности.
 */
export async function failureText(
  response: Response,
  reasons: Record<string, string>,
  fallback: string,
): Promise<string> {
  try {
    const body: unknown = await response.json();

    const reason = (body as { error?: { details?: { reason?: unknown } } }).error?.details?.reason;

    if (typeof reason === 'string' && reason in reasons) {
      return reasons[reason] ?? fallback;
    }
  } catch {
    // Тело не JSON — говорить об этом человеку нечего.
  }

  return fallback;
}
