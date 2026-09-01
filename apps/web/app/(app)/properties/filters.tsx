'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface Labels {
  search: string;
  reset: string;
  allStatuses: string;
  allTypes: string;
  apartment: string;
  house: string;
  land: string;
  commercial: string;
}

/**
 * Поиск и фильтры — DESIGN §37.
 *
 * Состояние живёт в адресе страницы, а не в памяти компонента: найденный
 * список должен открываться по ссылке и переживать перезагрузку. Агент,
 * отправивший коллеге ссылку на подборку, ожидает увидеть ту же подборку.
 */
export function PropertyFilters({
  labels,
  statuses,
}: {
  labels: Labels;
  statuses: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const apply = (key: string, value: string): void => {
    const next = new URLSearchParams(params.toString());
    if (value === '') next.delete(key);
    else next.set(key, value);

    router.replace(next.size === 0 ? '/properties' : `/properties?${next.toString()}`);
  };

  const types = [
    { value: 'APARTMENT', label: labels.apartment },
    { value: 'HOUSE', label: labels.house },
    { value: 'LAND', label: labels.land },
    { value: 'COMMERCIAL', label: labels.commercial },
  ];

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        apply('query', String(new FormData(event.currentTarget).get('query') ?? ''));
      }}
    >
      <input
        name="query"
        defaultValue={params.get('query') ?? ''}
        placeholder={labels.search}
        className="min-w-64 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
      />

      <select
        defaultValue={params.get('status') ?? ''}
        onChange={(event) => apply('status', event.target.value)}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
      >
        <option value="">{labels.allStatuses}</option>
        {statuses.map((status) => (
          <option key={status.id} value={status.id}>
            {status.name}
          </option>
        ))}
      </select>

      <select
        defaultValue={params.get('type') ?? ''}
        onChange={(event) => apply('type', event.target.value)}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
      >
        <option value="">{labels.allTypes}</option>
        {types.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => router.replace('/properties')}
        className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        {labels.reset}
      </button>
    </form>
  );
}
