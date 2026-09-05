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
/** Слово без первой буквы: её место занимает сам знак. */
const LOCKUP_TAIL = 'leek';
const WORDMARK_T = 'T';
const WORDMARK_O = 'o';

/**
 * Знак охраны авторского права рядом с последней буквой.
 *
 * Приподнят и уменьшен, как это принято у знаков возле логотипа: он часть
 * знака, но не часть слова. Цвет приглушён — иначе на светлой странице входа
 * он спорит по весу с самой буквой «o», у которой градиент.
 *
 * Не `aria-hidden`: экранная читалка произносит его как «copyright», и это
 * верно — знак несёт смысл, а не украшает.
 */
const WORDMARK_COPYRIGHT = '©';

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
      <span
        className={`self-start text-[0.55em] font-semibold leading-none ${
          tone === 'dark'
            ? 'text-[var(--color-sidebar-fg-muted)]'
            : 'text-[var(--color-text-tertiary)]'
        }`}
      >
        {WORDMARK_COPYRIGHT}
      </span>
    </span>
  );
}

/**
 * Фирменная сборка: знак ВМЕСТО первой буквы.
 *
 * `[K]leekTo`, а не `[знак] kleekTo`. Разница не косметическая: во втором
 * случае знак и слово — две отдельные вещи, стоящие рядом, и знак приходится
 * объяснять. В первом он читается как буква, и логотип становится одним
 * словом, которое узнаётся целиком.
 *
 * Отсюда и вся посадка: знак прижат к `leekTo` почти вплотную (задание
 * прямо запрещает большой пробел), его высота привязана к размеру шрифта
 * через `em`, поэтому сборка масштабируется целиком — и в панели, и на входе.
 *
 * `alt` пустой намеренно: знак здесь не картинка со смыслом, а первая буква
 * слова, которое тут же написано текстом. Читалке он не нужен — иначе она
 * произнесёт «k» дважды.
 */
export function BrandLockup({
  tone = 'light',
  className = '',
}: {
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <span className={`inline-flex items-baseline font-extrabold tracking-tight ${className}`}>
      <img
        src="/brand/mark.png"
        alt=""
        className="mr-[0.06em] size-[1.05em] shrink-0 translate-y-[0.12em] object-contain"
      />
      <span
        className={
          tone === 'dark' ? 'text-[var(--color-sidebar-fg)]' : 'text-[var(--color-text-primary)]'
        }
      >
        {LOCKUP_TAIL}
      </span>
      <span className="text-[var(--color-brand)]">{WORDMARK_T}</span>
      <span
        className="bg-clip-text text-transparent"
        style={{ backgroundImage: 'var(--gradient-primary)' }}
      >
        {WORDMARK_O}
      </span>
      <span
        className={`self-start text-[0.55em] leading-none font-semibold ${
          tone === 'dark'
            ? 'text-[var(--color-sidebar-fg-muted)]'
            : 'text-[var(--color-text-tertiary)]'
        }`}
      >
        {WORDMARK_COPYRIGHT}
      </span>
    </span>
  );
}
