import type { ComponentPropsWithoutRef, ReactNode } from 'react';

/**
 * Общие элементы интерфейса.
 *
 * ЗАЧЕМ ОНИ СОБРАНЫ ЗДЕСЬ. Кнопка, поле и карточка иначе расходятся: на одном
 * экране скругление 8, на другом 12, отступы у каждого свои. По отдельности
 * это мелочи, вместе — ощущение самодельности, ради борьбы с которым
 * дизайн-документ и написан (DESIGN §3: «не похоже на дешёвый админ-шаблон»).
 *
 * Строк здесь нет: всё, что видит человек, приходит пропсом из словаря
 * (правило 18).
 */

// ── Кнопки ───────────────────────────────────────────────────────────────────

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'sm';

const BUTTON_TONE: Record<ButtonTone, string> = {
  /*
   * Главное действие — фирменный градиент, а не плоская заливка.
   *
   * Смещение градиента при наведении — фирменный приём движения: цвет
   * едва заметно съезжает, кнопка «оживает» под курсором, но ничего
   * не двигается и не мигает. Достигается растяжкой фона вдвое и сдвигом
   * позиции, то есть без единого лишнего элемента в разметке.
   *
   * Отключённая кнопка теряет градиент вовсе: приглушённый градиент
   * по-прежнему выглядит нажимаемым.
   */
  primary:
    'bg-[image:var(--gradient-primary)] bg-[length:180%_100%] bg-[position:0%_0%] text-white shadow-[var(--shadow-card)] transition-[background-position,box-shadow,transform] hover:bg-[position:100%_0%] hover:shadow-[var(--shadow-hover)] disabled:bg-none disabled:bg-[var(--color-border-strong)] disabled:shadow-none',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]',
  ghost:
    'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)]',
  danger: 'bg-[var(--color-danger)] text-white hover:brightness-95',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  md: 'h-10 px-4 text-sm',
  sm: 'h-8 px-3 text-xs',
};

export function Button({
  tone = 'primary',
  size = 'md',
  className = '',
  ...rest
}: ComponentPropsWithoutRef<'button'> & { tone?: ButtonTone; size?: ButtonSize }) {
  return (
    <button
      {...rest}
      /*
       * ОТКЛИК НА НАЖАТИЕ, а не только на наведение.
       *
       * Кнопка, которая никак не отвечает на палец, ощущается сломанной
       * ещё до того, как придёт ответ сервера, — а ответ здесь идёт через
       * океан и занимает секунды. Просадка на 1% и есть та обратная связь,
       * которую человек ждёт в первые 50 мс.
       *
       * `active:` без `transition` был бы мгновенным скачком; с общей
       * длительностью он читается как нажатие, а не как подмена картинки.
       *
       * Масштаб 0.97, а не 0.99: разница в один процент на глаз не читается
       * вовсе, и вся затея теряет смысл.
       */
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium transition-[background-color,box-shadow,transform,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100 ${BUTTON_TONE[tone]} ${BUTTON_SIZE[size]} ${className}`}
    />
  );
}

// ── Поля ─────────────────────────────────────────────────────────────────────

/*
 * Ширина здесь НЕ задаётся. Внутри `Field` поле и так растягивается: это
 * колонка flex, а её дети растягиваются по умолчанию. Жёсткий `w-full`
 * в базовом стиле молча перебивал бы ширину, заданную на месте вызова, —
 * и фильтры на списке объектов встали в столбец вместо строки.
 */
const FIELD_BASE =
  'rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-[var(--color-text-tertiary)] focus:border-[var(--color-brand)] disabled:bg-[var(--color-surface-muted)]';

export function Input({ className = '', ...rest }: ComponentPropsWithoutRef<'input'>) {
  return <input {...rest} className={`${FIELD_BASE} h-10 ${className}`} />;
}

export function Select({ className = '', ...rest }: ComponentPropsWithoutRef<'select'>) {
  return <select {...rest} className={`${FIELD_BASE} h-10 pr-8 ${className}`} />;
}

/**
 * Поле с подписью.
 *
 * Подпись всегда сверху и всегда видима — не плейсхолдером. Плейсхолдер
 * исчезает при вводе, и человек, вернувшийся к форме, перестаёт понимать,
 * что в каком поле (DESIGN §35).
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      {children}
      {error === undefined ? (
        hint === undefined ? null : (
          <span className="text-xs text-[var(--color-text-secondary)]">{hint}</span>
        )
      ) : (
        <span className="text-xs text-[var(--color-danger)]">{error}</span>
      )}
    </label>
  );
}

// ── Поверхности ──────────────────────────────────────────────────────────────

export function Card({ className = '', ...rest }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...rest}
      /*
       * КАРТОЧКА ЧЁТКАЯ, А НЕ МУТНАЯ.
       *
       * Прошлая версия была полупрозрачным стеклом с размытием. На экране,
       * где карточек полтора десятка, это дало кашу: сквозь каждую
       * просвечивал фон, границы расплылись, и лист перестал делиться
       * на части. Стекло хорошо для одного слоя поверх содержимого —
       * панели, всплывающего окна, — а не для каждого блока подряд.
       *
       * Поэтому здесь непрозрачный белый, настоящая граница в один пиксель
       * и слоистая тень. Граница держит край там, где тень слаба; тень
       * говорит, что карточка выше листа.
       */
      className={`rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${className}`}
    />
  );
}

/**
 * Карточка, которая отзывается на курсор.
 *
 * Отдельно от `Card`, потому что подниматься должно только то, что можно
 * нажать. Карточка, которая ездит под курсором и никуда не ведёт, обманывает.
 *
 * Отклик — сдвиг на два пикселя, рост тени и потемнение границы. Только
 * `transform` и `box-shadow`: ничего, что заставит браузер пересчитывать
 * раскладку. Проверка `hover: hover` отсекает касание — на телефоне
 * «наведения» не бывает, и без неё состояние залипало бы после тапа.
 */
export function InteractiveCard({ className = '', ...rest }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...rest}
      className={`rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] [@media(hover:hover)and(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)and(pointer:fine)]:hover:border-[var(--color-border-strong)] [@media(hover:hover)and(pointer:fine)]:hover:shadow-[var(--shadow-hover)] ${className}`}
    />
  );
}

export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {/* Заголовок обязан быть заметнее данных под ним. Пока он был
            того же размера, что и строки таблицы, страница читалась как
            один сплошной список без разделов. */}
        <h2 className="text-[0.9375rem] leading-6 font-semibold">{title}</h2>
        {hint === undefined ? null : (
          <p className="mt-1 max-w-prose text-[0.8125rem] leading-5 text-[var(--color-text-secondary)]">
            {hint}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {hint === undefined ? null : (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{hint}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// ── Метки ────────────────────────────────────────────────────────────────────

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]',
  brand: 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
};

/**
 * Метка статуса.
 *
 * `text-transform` не задаётся нигде: у мхедрули нет заглавных букв,
 * и приём, читающийся в английском как акцент, в грузинском не делает
 * ничего (правило 18).
 */
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-medium ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Пустое состояние.
 *
 * Отдельным компонентом, потому что пустой экран — это первое, что видит
 * новый агент. Строка «ничего нет» без объяснения, что делать дальше,
 * читается как поломка (DESIGN §27).
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      {/*
        ЗНАК ИЗ ГЕОМЕТРИИ ЛОГОТИПА (§26 задания).
        Пустой экран — тоже экран бренда: серая строка «ничего не найдено»
        выглядит как сбой, а фигура из тех же квадратов, что и знак, — как
        спокойное «здесь пока пусто». Четыре квадрата разной прозрачности
        фирменного градиента: тот же приём, что и в самом знаке.
      */}
      <span aria-hidden className="mb-1 grid grid-cols-2 gap-1">
        {[0.9, 0.55, 0.35, 0.7].map((opacity, index) => (
          <span
            key={opacity}
            className={`size-4 ${index === 0 ? 'rounded-tl-[var(--radius-sm)]' : ''} ${
              index === 3 ? 'rounded-br-[var(--radius-sm)]' : ''
            }`}
            style={{ backgroundImage: 'var(--gradient-primary)', opacity }}
          />
        ))}
      </span>

      <p className="text-[0.9375rem] font-semibold">{title}</p>
      {hint === undefined ? null : (
        <p className="max-w-md text-sm text-[var(--color-text-secondary)]">{hint}</p>
      )}
      {action === undefined ? null : <div className="mt-3">{action}</div>}
    </Card>
  );
}

/** Полоска над формой: ошибка или подтверждение. */
export function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const style =
    tone === 'error'
      ? 'border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
      : 'border-[var(--color-success)]/25 bg-[var(--color-success-soft)] text-[var(--color-success)]';

  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-[var(--radius-control)] border px-3 py-2 text-sm ${style}`}
    >
      {children}
    </p>
  );
}
