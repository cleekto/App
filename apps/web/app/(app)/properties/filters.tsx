'use client';

import { Button, Input, Select } from '../../_ui/primitives';

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
      {/*
        `basis-full`, а не `w-full`: контейнер — `flex`, а `flex-1` (нужен
        от `sm:` и шире, чтобы поле росло вместе с соседями) даёт
        `flex-basis: 0%`, который перебивает `width` при расчёте размера
        по главной оси. `basis-full` — это и есть `flex-basis`, поэтому
        на телефоне поле честно занимает всю строку и переносит селекты
        на следующую, а не схлопывается до нескольких пикселей. Найдено
        не глазами, а расчётом `getComputedStyle` — на глаз в браузере
        разница между «почти не видно» и «0 не видно» неразличима.
      */}
      <Input
        name="query"
        defaultValue={params.get('query') ?? ''}
        placeholder={labels.search}
        className="min-w-0 basis-full sm:w-auto sm:min-w-64 sm:flex-1 sm:basis-auto"
      />

      <Select
        defaultValue={params.get('status') ?? ''}
        onChange={(event) => apply('status', event.target.value)}
      >
        <option value="">{labels.allStatuses}</option>
        {statuses.map((status) => (
          <option key={status.id} value={status.id}>
            {status.name}
          </option>
        ))}
      </Select>

      <Select
        defaultValue={params.get('type') ?? ''}
        onChange={(event) => apply('type', event.target.value)}
      >
        <option value="">{labels.allTypes}</option>
        {types.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </Select>

      <Button tone="ghost" type="button" onClick={() => router.replace('/properties')}>
        {labels.reset}
      </Button>
    </form>
  );
}
