import { formatNumber, translate } from '@kleekto/i18n';
import type { Locale } from '@kleekto/i18n';

/**
 * Характеристики объекта из объявления.
 *
 * ПОКАЗЫВАЕТСЯ ТОЛЬКО ТО, ЧТО ЗАПОЛНЕНО. Пустое поле означает, что площадка
 * о нём не сказала, и строка «Тип проекта: —» агенту ничего не даёт: она
 * занимает место и делает вид, что данные проверены. Площадки отдают
 * разный набор, поэтому у одного объекта строк три, у другого одиннадцать,
 * и это штатный режим (правило 14).
 *
 * Блока целиком не будет, если не заполнено ничего.
 */

type Facts = {
  bedrooms: number | null;
  bathrooms: string | null;
  balconies: number | null;
  balconyArea: number | null;
  houseArea: number | null;
  yardArea: number | null;
  condition: string | null;
  buildingStatus: string | null;
  projectType: string | null;
  cadastralCode: string | null;
  sellerKind: 'owner' | 'agency' | null;
};

const SQUARE_METRES = ' м²';

export function Characteristics({ locale, facts }: { locale: Locale; facts: Facts }) {
  const t = (key: Parameters<typeof translate>[1]): string => translate(locale, key);
  const area = (value: number | null): string | null =>
    value === null ? null : formatNumber(locale, value) + SQUARE_METRES;
  const count = (value: number | null): string | null =>
    value === null ? null : formatNumber(locale, value);

  const rows: Array<[string, string | null]> = [
    [t('property.bedrooms'), count(facts.bedrooms)],
    [t('property.bathrooms'), facts.bathrooms],
    [t('property.balconies'), count(facts.balconies)],
    [t('property.balconyArea'), area(facts.balconyArea)],
    [t('property.houseArea'), area(facts.houseArea)],
    [t('property.yardArea'), area(facts.yardArea)],
    [t('property.condition'), facts.condition],
    [t('property.buildingStatus'), facts.buildingStatus],
    [t('property.projectType'), facts.projectType],
    [t('property.cadastralCode'), facts.cadastralCode],
    [
      t('property.sellerKind'),
      facts.sellerKind === null
        ? null
        : facts.sellerKind === 'owner'
          ? t('property.sellerOwner')
          : t('property.sellerAgency'),
    ],
  ];

  const filled = rows.filter((row): row is [string, string] => row[1] !== null && row[1] !== '');
  if (filled.length === 0) return null;

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="text-sm font-semibold">{t('property.characteristics')}</h2>

      {/* Две колонки на широком экране, одна на узком. Подпись и значение
          стоят в одной строке с точками между ними: так глаз находит нужное
          поле, не считая строки сверху. */}
      <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        {filled.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="shrink-0 text-[var(--color-text-secondary)]">{label}</dt>
            <span
              aria-hidden
              className="min-w-4 grow border-b border-dotted border-[var(--color-border)]"
            />
            <dd className="shrink-0 text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
