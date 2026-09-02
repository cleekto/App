'use client';

import { useState, type ComponentPropsWithoutRef } from 'react';

import { Input } from './primitives';

/**
 * Поле пароля с переключателем видимости.
 *
 * По умолчанию текст скрыт (`type="password"`) — переключатель только
 * раскрывает его по явному нажатию, не наоборот: человек, набирающий пароль
 * на людях, не должен неожиданно показать его соседу.
 */
export function PasswordInput({
  showLabel,
  hideLabel,
  className = '',
  ...rest
}: Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...rest} type={visible ? 'text' : 'password'} className={`pr-10 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
      >
        {visible ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
            aria-hidden="true"
          >
            <path d="M3 3l18 18" />
            <path d="M10.58 10.58a3 3 0 0 0 4.24 4.24" />
            <path d="M9.88 4.62A10.94 10.94 0 0 1 12 4.5c6.75 0 10.5 7 10.5 7a13.2 13.2 0 0 1-3.11 3.94M6.6 6.6C3.88 8.36 1.5 12 1.5 12a13.14 13.14 0 0 0 5.02 5.5A10.9 10.9 0 0 0 12 19.5c1.06 0 2.07-.14 3-.42" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
            aria-hidden="true"
          >
            <path d="M1.5 12s3.75-7 10.5-7 10.5 7 10.5 7-3.75 7-10.5 7S1.5 12 1.5 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
