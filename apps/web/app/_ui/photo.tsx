'use client';

import { useState } from 'react';

/**
 * Фотография объекта.
 *
 * ПОЧЕМУ ОБЫЧНЫЙ `img`, А НЕ `next/image`. Ссылки ведут на CDN площадок,
 * и оптимизатор Next требует заранее перечислить их домены в
 * `remotePatterns`. Проверенных данных о том, с каких именно хостов ss.ge
 * и myhome.ge отдают картинки, у нас нет, а угадывать их запрещено
 * (правило 2): промах означал бы, что фотографии молча пропали у всех.
 * Обычный `img` работает с любой ссылкой и ничего не требует знать заранее.
 *
 * ССЫЛКА ЧУЖАЯ И МОЖЕТ ОТВАЛИТЬСЯ. Объявление снимут, CDN сменит адрес —
 * и на месте фотографии остался бы значок битой картинки. Поэтому ошибка
 * загрузки показывает тот же знак, что и у объекта без фото: пустое место
 * выглядит нормально, сломанное — нет.
 *
 * `no-referrer`: браузер иначе сообщил бы площадке адрес нашей страницы
 * при каждой загрузке картинки. Ей знать его незачем.
 */
export function Photo({
  src,
  alt,
  className = '',
}: {
  src: string | null;
  /** Описание для экранной читалки. Приходит из словаря (правило 18). */
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  /*
   * РАЗМЕР ЗАДАЁТ ОБЁРТКА, А НЕ КАРТИНКА.
   *
   * Сначала размер и `h-full` стояли на самом `img` — и высота схлопывалась:
   * два правила одной силы, побеждает то, что в таблице стилей ниже, а это
   * `h-full`, которому не от чего считаться. На экране фотографии просто
   * не было, а знак «фото нет» рисовался исправно, потому что у него
   * конкурирующего правила не было.
   */
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] ${className}`}
      {...(src === null || broken ? { role: 'img', 'aria-label': alt } : {})}
    >
      {src === null || broken ? (
        <EmptyMark />
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

/**
 * Знак вместо фотографии: очертание дома.
 *
 * Рисуется здесь, а не подключается библиотекой иконок: она одна.
 * Приглушён настолько, чтобы читаться как «фотографии нет», а не как
 * содержимое карточки.
 */
function EmptyMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-full w-full p-[22%] text-[var(--color-text-tertiary)] opacity-50"
    >
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}
