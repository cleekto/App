import type { Metadata } from 'next';
import { Inter, Noto_Sans_Georgian } from 'next/font/google';
import type { ReactNode } from 'react';

import { translate } from '@kleekto/i18n';

import { serverLocale } from './locale';
import './globals.css';

/**
 * Шрифты. ДВА, И ЭТО ВЫНУЖДЕННО.
 *
 * DESIGN §7 предлагает Inter, но там же требует отфильтровать список по
 * покрытию грузинского: «гарнитура без мхедрули — не кандидат, как бы хорошо
 * она ни читалась в латинице». Inter мхедрули не покрывает.
 *
 * Поэтому Inter несёт латиницу и кириллицу, Noto Sans Georgian — грузинский,
 * и оба стоят в одном стеке. Браузер берёт для каждого символа первый шрифт,
 * в котором этот символ есть; на смешанной строке — а такие здесь постоянно,
 * «ბაგები · 179 000 $» — это работает само.
 *
 * Шрифты самохостятся Next во время сборки: обращения к Google из браузера
 * агента не будет.
 */
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-latin',
});

const georgian = Noto_Sans_Georgian({
  subsets: ['georgian'],
  display: 'swap',
  variable: '--font-georgian',
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await serverLocale();
  return {
    title: translate(locale, 'app.name'),
    description: translate(locale, 'app.tagline'),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await serverLocale();

  // `lang` обязан отражать реальный язык страницы: от него зависят перенос
  // строк, подстановка шрифта и произношение в экранных читалках.
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${georgian.variable}`}
      style={{ '--font-app': `var(--font-latin), var(--font-georgian)` } as React.CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}
