import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { translate } from '@cleekto/i18n';

import { serverLocale } from './locale';
import './globals.css';

export function generateMetadata(): Metadata {
  const locale = serverLocale();
  return {
    title: translate(locale, 'app.name'),
    description: translate(locale, 'app.tagline'),
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // `lang` обязан отражать реальный язык страницы: от него зависят перенос
  // строк, подстановка шрифта и произношение в экранных читалках.
  return (
    <html lang={serverLocale()}>
      <body>{children}</body>
    </html>
  );
}
