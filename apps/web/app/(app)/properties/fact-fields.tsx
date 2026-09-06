'use client';

import { Field, Input, Select } from '../../_ui/primitives';

/**
 * Поля объекта — один набор на заведение и на правку.
 *
 * СОСТАВ ПОВТОРЯЕТ ФОРМЫ РАЗМЕЩЕНИЯ ss.ge И myhome.ge (решение владельца
 * 2026-09-06): объект, заведённый руками, обязан годиться для публикации
 * без дозаполнения. Иначе агент вводит одно и то же дважды — сначала в CRM,
 * потом на площадке.
 *
 * ПОЧЕМУ ОДИН КОМПОНЕНТ. Пока форм было две, они расходились: поле
 * появлялось в заведении и не появлялось в правке — и опечатку
 * в кадастровом коде нельзя было исправить нигде.
 *
 * Обязательных полей здесь нет, кроме вида сделки и типа недвижимости.
 * Частичное заполнение — штатный режим (правило 14): агент заводит объект
 * по телефонному разговору, а не по анкете.
 *
 * Строк в компоненте нет — всё приходит из словаря (правило 18).
 */

export interface FactLabels {
  transactionType: string;
  propertyType: string;
  rooms: string;
  bedrooms: string;
  area: string;
  floor: string;
  totalFloors: string;
  bathrooms: string;
  balconies: string;
  balconyArea: string;
  houseArea: string;
  yardArea: string;
  condition: string;
  buildingStatus: string;
  projectType: string;
  cadastralCode: string;
  sellerKind: string;
  sellerOwner: string;
  sellerAgency: string;
  notSpecified: string;
  district: string;
  address: string;
  price: string;
  currency: string;
}

/** Значения, уже лежащие у объекта. При заведении пусто. */
export interface FactValues {
  transactionType?: string | null;
  propertyType?: string | null;
  rooms?: number | null;
  bedrooms?: number | null;
  areaTotal?: number | null;
  floor?: number | null;
  totalFloors?: number | null;
  bathrooms?: string | null;
  balconies?: number | null;
  balconyArea?: number | null;
  houseArea?: number | null;
  yardArea?: number | null;
  condition?: string | null;
  buildingStatus?: string | null;
  projectType?: string | null;
  cadastralCode?: string | null;
  sellerKind?: string | null;
  district?: string | null;
  addressRaw?: string | null;
  price?: number | null;
  currency?: string | null;
}

/**
 * Валюты, в которых агентства ведут объекты в Грузии.
 *
 * Доллар первым: цены на недвижимость в Тбилиси называют в нём, а лари —
 * валюта расчётов. Список закрыт: свободное поле здесь дало бы «USD»,
 * «usd» и «долл.» в одной базе, и сравнивать цены стало бы нечем.
 */
export const CURRENCIES = ['USD', 'GEL', 'EUR'] as const;

/** Число из формы: пустое поле — это «не указано», а не ноль. */
export function optionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  if (raw === '') return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function optionalText(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? '').trim();
  return raw === '' ? null : raw;
}

/**
 * Разбор всех фактов из формы одним вызовом.
 *
 * Живёт рядом с полями намеренно: список того, что рисуется, и список того,
 * что читается, обязаны меняться вместе. Разъехавшись, они дают самую тихую
 * из ошибок — поле на экране есть, а до базы не доезжает.
 */
export function readFacts(form: FormData): Record<string, unknown> {
  return {
    transactionType: String(form.get('transactionType') ?? ''),
    propertyType: String(form.get('propertyType') ?? ''),
    rooms: optionalNumber(form.get('rooms')),
    bedrooms: optionalNumber(form.get('bedrooms')),
    areaTotal: optionalNumber(form.get('areaTotal')),
    floor: optionalNumber(form.get('floor')),
    totalFloors: optionalNumber(form.get('totalFloors')),
    bathrooms: optionalText(form.get('bathrooms')),
    balconies: optionalNumber(form.get('balconies')),
    balconyArea: optionalNumber(form.get('balconyArea')),
    houseArea: optionalNumber(form.get('houseArea')),
    yardArea: optionalNumber(form.get('yardArea')),
    condition: optionalText(form.get('condition')),
    buildingStatus: optionalText(form.get('buildingStatus')),
    projectType: optionalText(form.get('projectType')),
    cadastralCode: optionalText(form.get('cadastralCode')),
    sellerKind: optionalText(form.get('sellerKind')),
    district: optionalText(form.get('district')),
    addressRaw: optionalText(form.get('addressRaw')),
    price: optionalNumber(form.get('price')),
    currency: optionalText(form.get('currency')),
  };
}

/** Значение поля для формы: пусто показывается пустым, а не словом «null». */
function text(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Готовый список для раскрывающегося поля. */
export interface Option {
  value: string;
  label: string;
}

/**
 * Все справочники разом.
 *
 * Приходят готовыми с сервера: подписи берутся из словаря, а звать `translate`
 * в браузере агента нельзя — у него может не быть данных грузинской локали.
 */
export interface FactDictionaries {
  types: Option[];
  transactions: Option[];
  conditions: Option[];
  buildingStatuses: Option[];
  projectTypes: Option[];
}

/**
 * Список с сохранением того, что пришло с площадки.
 *
 * ЧУЖОЕ ЗНАЧЕНИЕ НЕ ТЕРЯЕТСЯ. Поля состояния, статуса дома и типа проекта
 * заполняет не только человек: с ss.ge и myhome.ge приходит то, что написано
 * там, и их списки шире нашего. Если бы список показывал только известные
 * коды, первое же сохранение формы стёрло бы пришедшее с объявления —
 * молча и без следа.
 *
 * Поэтому незнакомое значение добавляется в список отдельной строкой и
 * остаётся выбранным. Показывается как есть: перевести его нечем, да и врать
 * о том, что написано на площадке, нельзя (правило 14).
 */
function withCurrent(options: Option[], current: string | null | undefined): Option[] {
  if (current === null || current === undefined || current === '') return options;
  if (options.some((option) => option.value === current)) return options;

  return [...options, { value: current, label: current }];
}

export function FactFields({
  labels,
  dictionaries,
  values = {},
}: {
  labels: FactLabels;
  dictionaries: FactDictionaries;
  values?: FactValues;
}) {
  const { types, transactions } = dictionaries;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.transactionType}>
          <Select name="transactionType" defaultValue={values.transactionType ?? 'SALE'}>
            {transactions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={labels.propertyType}>
          <Select name="propertyType" defaultValue={values.propertyType ?? 'APARTMENT'}>
            {types.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.address}>
          <Input name="addressRaw" autoComplete="off" defaultValue={text(values.addressRaw)} />
        </Field>

        <Field label={labels.district}>
          <Input name="district" autoComplete="off" defaultValue={text(values.district)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={labels.rooms}>
          <Input name="rooms" inputMode="numeric" defaultValue={text(values.rooms)} />
        </Field>
        <Field label={labels.bedrooms}>
          <Input name="bedrooms" inputMode="numeric" defaultValue={text(values.bedrooms)} />
        </Field>
        <Field label={labels.area}>
          <Input name="areaTotal" inputMode="decimal" defaultValue={text(values.areaTotal)} />
        </Field>
        <Field label={labels.bathrooms}>
          <Input name="bathrooms" defaultValue={text(values.bathrooms)} />
        </Field>
        <Field label={labels.floor}>
          <Input name="floor" inputMode="numeric" defaultValue={text(values.floor)} />
        </Field>
        <Field label={labels.totalFloors}>
          <Input name="totalFloors" inputMode="numeric" defaultValue={text(values.totalFloors)} />
        </Field>
        <Field label={labels.balconies}>
          <Input name="balconies" inputMode="numeric" defaultValue={text(values.balconies)} />
        </Field>
        <Field label={labels.balconyArea}>
          <Input name="balconyArea" inputMode="decimal" defaultValue={text(values.balconyArea)} />
        </Field>
      </div>

      {/* Дом и двор — только у частных домов. Поля показываются всегда:
          прятать их по типу недвижимости значило бы решать за агента,
          который как раз этот тип и меняет. Пустыми они ничего не стоят. */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={labels.houseArea}>
          <Input name="houseArea" inputMode="decimal" defaultValue={text(values.houseArea)} />
        </Field>
        <Field label={labels.yardArea}>
          <Input name="yardArea" inputMode="decimal" defaultValue={text(values.yardArea)} />
        </Field>
        <Field label={labels.price}>
          <Input name="price" inputMode="decimal" defaultValue={text(values.price)} />
        </Field>
        <Field label={labels.currency}>
          <Select name="currency" defaultValue={values.currency ?? CURRENCIES[0]}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.condition}>
          <Select name="condition" defaultValue={values.condition ?? ''}>
            <option value="">{labels.notSpecified}</option>
            {withCurrent(dictionaries.conditions, values.condition).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={labels.buildingStatus}>
          <Select name="buildingStatus" defaultValue={values.buildingStatus ?? ''}>
            <option value="">{labels.notSpecified}</option>
            {withCurrent(dictionaries.buildingStatuses, values.buildingStatus).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={labels.projectType}>
          <Select name="projectType" defaultValue={values.projectType ?? ''}>
            <option value="">{labels.notSpecified}</option>
            {withCurrent(dictionaries.projectTypes, values.projectType).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={labels.cadastralCode}>
          <Input name="cadastralCode" defaultValue={text(values.cadastralCode)} />
        </Field>
      </div>

      <Field label={labels.sellerKind}>
        <Select name="sellerKind" defaultValue={values.sellerKind ?? ''}>
          {/* Пустое первым: «не сказано» — самое частое состояние, и
              подставлять вместо него «собственник» значило бы придумывать
              (правило 14). */}
          <option value="">{labels.notSpecified}</option>
          <option value="owner">{labels.sellerOwner}</option>
          <option value="agency">{labels.sellerAgency}</option>
        </Select>
      </Field>
    </>
  );
}
