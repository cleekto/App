import { describe, expect, it } from 'vitest';

import type { AuthContext } from '../auth/context';
import { keepablePhotos, ownKeys } from './photos';

/**
 * Список фотографий приходит от браузера, и это единственное место, где
 * решается, что из него уцелеет. Правила короткие, но цена ошибки разная:
 * чужой ключ — утечка через границу компании, чужой адрес — обращение
 * браузера агента на посторонний сервер.
 */

const ctx = { companyId: 'наша-компания' } as AuthContext;

describe('ownKeys', () => {
  it('оставляет только ключи своей компании', () => {
    expect(ownKeys(ctx, ['наша-компания/property/один.jpg', 'соседи/property/два.jpg'])).toEqual([
      'наша-компания/property/один.jpg',
    ]);
  });

  it('чужой ключ отсеивается молча, а не роняет заведение', () => {
    expect(ownKeys(ctx, ['соседи/property/два.jpg'])).toEqual([]);
  });

  it('без списка — пусто', () => {
    expect(ownKeys(ctx, undefined)).toEqual([]);
  });

  it('больше двадцати снимков не берётся', () => {
    const many = Array.from({ length: 25 }, (_, index) => `наша-компания/property/${index}.jpg`);
    expect(ownKeys(ctx, many)).toHaveLength(20);
  });
});

describe('keepablePhotos', () => {
  const external = 'https://static.ss.ge/photo/один.jpg';

  it('свой ключ хранилища принимается', () => {
    expect(keepablePhotos(ctx, ['наша-компания/property/новый.jpg'], [])).toEqual([
      'наша-компания/property/новый.jpg',
    ]);
  });

  it('внешний адрес, уже лежащий у объекта, остаётся: иначе его не переставить', () => {
    expect(keepablePhotos(ctx, [external], [external])).toEqual([external]);
  });

  it('НОВЫЙ внешний адрес не принимается', () => {
    expect(keepablePhotos(ctx, ['https://чужой-сервер/картинка.jpg'], [external])).toEqual([]);
  });

  it('ключ чужой компании не принимается даже вместе со своими', () => {
    expect(
      keepablePhotos(ctx, ['соседи/property/два.jpg', 'наша-компания/property/один.jpg'], []),
    ).toEqual(['наша-компания/property/один.jpg']);
  });

  it('убранная фотография просто не попадает в список', () => {
    const current = ['наша-компания/property/один.jpg', 'наша-компания/property/два.jpg'];
    expect(keepablePhotos(ctx, [current[1] as string], current)).toEqual([current[1]]);
  });

  it('порядок сохраняется: первая фотография — обложка объекта', () => {
    const current = ['наша-компания/property/один.jpg', 'наша-компания/property/два.jpg'];
    expect(keepablePhotos(ctx, [...current].reverse(), current)).toEqual([...current].reverse());
  });
});
