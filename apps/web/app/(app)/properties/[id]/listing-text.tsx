import { CopyButton } from '../../../_ui/copy-button';

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

              <CopyButton text={block.text} labels={{ copy: labels.copy, copied: labels.copied }} />
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
