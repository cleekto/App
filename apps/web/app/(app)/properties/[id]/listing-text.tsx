'use client';

import { useState } from 'react';

/**
 * Текст объявления на трёх языках — с кнопкой «скопировать» у каждого.
 *
 * ЗАЧЕМ. Форма myhome спрашивает описание отдельно на грузинском,
 * английском и русском. Агент писал их руками трижды — это самая долгая
 * часть размещения, дольше даже загрузки шестнадцати фотографий. Текст
 * собран на сервере из характеристик объекта; здесь его остаётся забрать.
 *
 * ТЕКСТ ПОКАЗАН, А НЕ СПРЯТАН ЗА КНОПКОЙ. Агент вставляет его в чужую
 * форму под своим именем и обязан видеть, что именно копирует, — иначе
 * в объявлении окажется то, чего он не читал.
 */

interface Block {
  locale: string;
  /** Как называется язык на нём самом: подпись не переводится. */
  label: string;
  text: string;
}

export function ListingText({
  blocks,
  labels,
}: {
  blocks: Block[];
  labels: { title: string; hint: string; copy: string; copied: string };
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (block: Block): Promise<void> => {
    try {
      await navigator.clipboard.writeText(block.text);
      setCopied(block.locale);

      // Отметка гаснет сама: она подтверждает действие, а не остаётся
      // состоянием, которое агенту потом сбрасывать.
      setTimeout(() => {
        setCopied((current) => (current === block.locale ? null : current));
      }, 2000);
    } catch {
      /*
       * Буфер обмена может быть закрыт настройками браузера. Текст при этом
       * виден целиком — агент выделит и скопирует руками, и это лучше,
       * чем сообщение об ошибке там, где выход очевиден.
       */
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{labels.title}</p>
      <p className="text-[0.75rem] text-[var(--color-text-tertiary)]">{labels.hint}</p>

      <div className="grid gap-3 lg:grid-cols-3">
        {blocks.map((block) => (
          <div
            key={block.locale}
            className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.75rem] font-medium text-[var(--color-text-secondary)]">
                {block.label}
              </span>

              <button
                type="button"
                onClick={() => void copy(block)}
                className="rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-2 py-1 text-[0.6875rem] transition-colors duration-[var(--duration-fast)] [@media(hover:hover)and(pointer:fine)]:hover:bg-[var(--color-surface-muted)]"
              >
                {copied === block.locale ? labels.copied : labels.copy}
              </button>
            </div>

            {/*
              `whitespace-pre-line` — перечень собран переносами строк,
              и без этого он слился бы в один абзац, непохожий на то,
              что уйдёт в форму.
            */}
            <p className="whitespace-pre-line text-[0.75rem] leading-5 text-[var(--color-text-secondary)]">
              {block.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
