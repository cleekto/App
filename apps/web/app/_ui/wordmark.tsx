/**
 * Словесный знак «kleekTo».
 *
 * Не текст, а знак: имя бренда одинаково на всех трёх языках и переводу
 * не подлежит (правило 18) — та же логика, что уже применена к букве-плейсхолдеру
 * в `(app)/layout.tsx` и `login/page.tsx` до утверждения логотипа. Части
 * вынесены в константы, а не написаны прямо в JSX: `react/jsx-no-literals`
 * ловит именно литералы в разметке, не значения переменных.
 *
 * Раскраска — из `docs/design/concept.png`: тёмно-синее «kleek», фиолетовая
 * «T», буква «o» — тем же диагональным градиентом, что и знак рядом.
 */
const WORDMARK_KLEEK = 'kleek';
const WORDMARK_T = 'T';
const WORDMARK_O = 'o';

export function Wordmark({
  tone = 'light',
  className = '',
}: {
  /** Знак стоит и на светлой странице входа, и на тёмной боковой панели. */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <span className={`inline-flex items-baseline font-extrabold tracking-tight ${className}`}>
      <span
        className={
          tone === 'dark' ? 'text-[var(--color-sidebar-fg)]' : 'text-[var(--color-text-primary)]'
        }
      >
        {WORDMARK_KLEEK}
      </span>
      <span className="text-[var(--color-brand)]">{WORDMARK_T}</span>
      <span
        className="bg-clip-text text-transparent"
        style={{
          backgroundImage: 'linear-gradient(135deg, #7C3AED 0%, #FF2D8D 55%, #FF8A00 100%)',
        }}
      >
        {WORDMARK_O}
      </span>
    </span>
  );
}
