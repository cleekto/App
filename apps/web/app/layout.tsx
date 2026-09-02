import type { Metadata } from 'next';
import { Manrope, Noto_Sans_Georgian } from 'next/font/google';
import type { ReactNode } from 'react';

import { translate } from '@kleekto/i18n';

import { serverLocale } from './locale';
import './globals.css';

/**
 * Шрифты. ДВА, И ЭТО ВЫНУЖДЕННО.
 *
 * Manrope — гарнитура бренда kleekTo (`docs/design/concept.png`), выбрана
 * владельцем вместе с логотипом. DESIGN §7 предупреждает: гарнитуру нужно
 * фильтровать по покрытию грузинского, «как бы хорошо она ни читалась
 * в латинице» — и у Manrope мхедрули нет (её субсеты на Google Fonts:
 * cyrillic, cyrillic-ext, greek, latin, latin-ext, vietnamese).
 *
 * Поэтому Manrope несёт латиницу и кириллицу, Noto Sans Georgian —
 * грузинский, и оба стоят в одном стеке — та же схема, что была с Inter
 * до ребрендинга. Браузер берёт для каждого символа первый шрифт, в котором
 * этот символ есть; на смешанной строке — а такие здесь постоянно,
 * «ბაგები · 179 000 $» — это работает само.
 *
 * Шрифты самохостятся Next во время сборки: обращения к Google из браузера
 * агента не будет.
 */
const manrope = Manrope({
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
      className={`${manrope.variable} ${georgian.variable}`}
      style={{ '--font-app': `var(--font-latin), var(--font-georgian)` } as React.CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}
