/**
 * Скелет вместо крутящегося колеса (§27 задания).
 *
 * ПОЧЕМУ НЕ СПИННЕР. Колесо говорит «ждите» и больше ничего: экран остаётся
 * пустым, и человек не знает, что сейчас появится — список из двадцати строк
 * или сообщение «ничего нет». Скелет показывает форму будущего содержимого,
 * поэтому переход ощущается быстрее, даже когда занимает столько же времени.
 *
 * ПЕРЕЛИВ, А НЕ МИГАНИЕ. Полоса света проходит по серому один раз в полторы
 * секунды и уходит; ничего не меняет размеров и не прыгает. Владелец уже
 * останавливал меня за мельтешение фона — здесь тот же урок: движение
 * на экране, где человек ждёт, должно быть спокойным. Кто выключил анимацию
 * в системе, видит ровный серый.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`skeleton block rounded-[var(--radius-sm)] ${className}`} />;
}

/**
 * Скелет строки списка: картинка, две строки текста, число справа.
 *
 * Повторяет раскладку настоящей строки объекта — иначе при появлении данных
 * содержимое прыгнет, и выигрыш от скелета обнулится.
 */
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3">
          <Skeleton className="h-12 w-16" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Скелет плитки показателя. */
export function SkeletonTiles({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col justify-between gap-6 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <Skeleton className="size-11 rounded-[var(--radius-control)]" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
