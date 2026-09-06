'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { Input, Select } from '../../_ui/primitives';

interface Labels {
  district: string;
  priceMax: string;
  allTypes: string;
  allDeals: string;
  apartment: string;
  house: string;
  land: string;
  commercial: string;
  sale: string;
  rent: string;
}

/**
 * Фильтры ленты.
 *
 * Состояние живёт в адресе, как и в списке объектов: подборка обязана
 * открываться по ссылке и переживать перезагрузку. Здесь это важнее,
 * чем там, — агент присылает коллеге не «ленту», а «вот эти в Ваке до 80».
 *
 * Фильтров нарочно мало. Лента — очередь звонков, а не поиск: чем больше
 * условий, тем чаще она оказывается пустой, и тем скорее агент перестанет
 * в неё заходить.
 */
export function FeedFilters({ labels }: { labels: Labels }) {
  const router = useRouter();
  const params = useSearchParams();

  const apply = (key: string, value: string): void => {
    const next = new URLSearchParams(params.toString());
    if (value === '') next.delete(key);
    else next.set(key, value);

    router.replace(next.size === 0 ? '/feed' : `/feed?${next.toString()}`);
  };

  const types = [
    { value: 'APARTMENT', label: labels.apartment },
    { value: 'HOUSE', label: labels.house },
    { value: 'LAND', label: labels.land },
    { value: 'COMMERCIAL', label: labels.commercial },
  ];

  const deals = [
    { value: 'SALE', label: labels.sale },
    { value: 'RENT', label: labels.rent },
  ];

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        apply('district', String(form.get('district') ?? ''));
      }}
    >
      <Input
        name="district"
        defaultValue={params.get('district') ?? ''}
        placeholder={labels.district}
        className="min-w-0 basis-full sm:w-auto sm:min-w-56 sm:flex-1 sm:basis-auto"
      />

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

      <Select
        defaultValue={params.get('deal') ?? ''}
        onChange={(event) => apply('deal', event.target.value)}
      >
        <option value="">{labels.allDeals}</option>
        {deals.map((deal) => (
          <option key={deal.value} value={deal.value}>
            {deal.label}
          </option>
        ))}
      </Select>

      <Input
        name="priceMax"
        type="number"
        min={0}
        inputMode="numeric"
        defaultValue={params.get('priceMax') ?? ''}
        placeholder={labels.priceMax}
        className="w-32"
        onBlur={(event) => apply('priceMax', event.target.value)}
      />
    </form>
  );
}
