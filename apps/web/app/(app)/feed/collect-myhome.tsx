import { MYHOME_OWNER_PAGES } from '@kleekto/adapters';
import { translate } from '@kleekto/i18n';
import type { Locale, MessageKey } from '@kleekto/i18n';

/**
 * Открыть myhome там, где лежат только собственники.
 *
 * ПОЧЕМУ ЭТО ДЕЛАЕТ АГЕНТ, А НЕ СБОРЩИК. myhome стоит за Cloudflare: нашему
 * серверу приходит «Just a moment…» и 403. Обходить эту проверку мы не будем
 * — клиент, который бьётся в неё по расписанию, блокируется насовсем,
 * и первым это всплывёт в разговоре о доступе к API. А браузер агента
 * проходит её сам: он и есть браузер, с живой сессией и историей.
 *
 * ОДНО ОТКРЫТИЕ — ДВАДЦАТЬ СОБСТВЕННИКОВ. `owner_type=physical` — штатный
 * фильтр самой площадки, проверено живым браузером: четыре раздела,
 * по двадцать карточек, и во всех до одной тип продавца «частное лицо».
 * Ни одной догадки с нашей стороны — площадка отбирает сама.
 *
 * Ссылки, а не одна кнопка с четырьмя вкладками: браузер откроет по нажатию
 * только первую, остальные молча съест блокировщик всплывающих окон.
 * Четыре нажатия честнее одного, которое работает наполовину.
 */

/** Разделитель в подписи. Литералов в JSX нет (правило 18). */
const DOT = ' · ';

export function CollectFromMyhome({ locale }: { locale: Locale }) {
  const t = (key: MessageKey): string => translate(locale, key);

  return (
    <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
      <p className="text-[0.8125rem] font-medium">{t('feed.collect')}</p>

      <div className="flex flex-wrap items-center gap-2">
        {MYHOME_OWNER_PAGES.map((page) => (
          <a
            key={page.url}
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-[0.75rem] transition-colors duration-[var(--duration-fast)] [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)]"
          >
            {[
              translate(locale, `property.type.${page.propertyType}` as MessageKey),
              translate(locale, `property.transaction.${page.transactionType}` as MessageKey),
            ].join(DOT)}
          </a>
        ))}
      </div>

      <p className="text-[0.75rem] text-[var(--color-text-tertiary)]">{t('feed.collectHint')}</p>
    </section>
  );
}
