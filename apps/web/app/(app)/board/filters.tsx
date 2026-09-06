'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { Button, Input, Select } from '../../_ui/primitives';

/**
 * Фильтры доски: ответственный, команда, даты и поиск.
 *
 * ЗАЧЕМ ОНИ ИМЕННО ЗДЕСЬ. Доска отвечает на вопрос «где что стоит», и на
 * агентстве из двадцати человек она перестаёт отвечать: в колонке сорок
 * карточек, из них твоих три. Фильтр возвращает доске смысл — «где стоят
 * объекты Нино», «что завели на этой неделе».
 *
 * СОСТОЯНИЕ ЖИВЁТ В АДРЕСЕ, а не в памяти компонента: отфильтрованная доска
 * открывается по ссылке и переживает перезагрузку. Руководитель, отправивший
 * коллеге ссылку на срез, ожидает увидеть тот же срез.
 *
 * Списки людей и команд приходят готовыми: чего человеку не положено видеть,
 * до него не доезжает — и выбрать он этого не может.
 */

export interface BoardFilterLabels {
  search: string;
  allPeople: string;
  allTeams: string;
  from: string;
  to: string;
  reset: string;
}

export function BoardFilters({
  labels,
  people,
  teams,
}: {
  labels: BoardFilterLabels;
  people: Array<{ id: string; name: string }>;
  /** Пусто — выбирать не из чего: у человека одна команда либо ни одной. */
  teams: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const apply = (key: string, value: string): void => {
    const next = new URLSearchParams(params.toString());
    if (value === '') next.delete(key);
    else next.set(key, value);

    router.replace(next.size === 0 ? '/board' : `/board?${next.toString()}`);
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        apply('query', String(new FormData(event.currentTarget).get('query') ?? ''));
      }}
    >
      <Input
        name="query"
        defaultValue={params.get('query') ?? ''}
        placeholder={labels.search}
        className="min-w-0 basis-full sm:w-auto sm:min-w-56 sm:flex-1 sm:basis-auto"
      />

      {people.length === 0 ? null : (
        <Select
          aria-label={labels.allPeople}
          defaultValue={params.get('agent') ?? ''}
          onChange={(event) => apply('agent', event.target.value)}
        >
          <option value="">{labels.allPeople}</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
      )}

      {teams.length < 2 ? null : (
        <Select
          aria-label={labels.allTeams}
          defaultValue={params.get('team') ?? ''}
          onChange={(event) => apply('team', event.target.value)}
        >
          <option value="">{labels.allTeams}</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      )}

      {/*
        Дата вводится полем `date`, а не текстом: браузер сам покажет
        календарь на языке человека и сам разберёт написанное. Формат
        значения при этом всегда `ГГГГ-ММ-ДД` — тот же, что уходит в адрес,
        поэтому разбирать на сервере нечего.
      */}
      <Input
        type="date"
        aria-label={labels.from}
        defaultValue={params.get('from') ?? ''}
        onChange={(event) => apply('from', event.target.value)}
        className="w-auto"
      />
      <Input
        type="date"
        aria-label={labels.to}
        defaultValue={params.get('to') ?? ''}
        onChange={(event) => apply('to', event.target.value)}
        className="w-auto"
      />

      <Button tone="ghost" type="button" onClick={() => router.replace('/board')}>
        {labels.reset}
      </Button>
    </form>
  );
}
