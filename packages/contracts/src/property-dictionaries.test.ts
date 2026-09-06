import { describe, expect, it } from 'vitest';

import {
  BUILDING_STATUSES,
  CONDITIONS,
  PROJECT_TYPES,
  isKnownBuildingStatus,
  isKnownCondition,
  isKnownProjectType,
} from './property-dictionaries';

/**
 * Справочник — это договор между формой, импортом и словарём. Разойдутся —
 * и «белый каркас», выбранный в форме, перестанет совпадать с «белым
 * каркасом», пришедшим с площадки.
 */
describe('справочники полей объявления', () => {
  it('коды не повторяются', () => {
    for (const list of [CONDITIONS, BUILDING_STATUSES, PROJECT_TYPES]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('коды пишутся строчными с подчёркиванием — так они попадают в ключ словаря', () => {
    for (const code of [...CONDITIONS, ...BUILDING_STATUSES, ...PROJECT_TYPES]) {
      expect(code, code).toMatch(/^[a-z][a-z0-9_]*$/u);
    }
  });

  it('состав закреплён: список задан владельцем, а не выведен', () => {
    expect(CONDITIONS).toHaveLength(8);
    expect(BUILDING_STATUSES).toHaveLength(3);
    expect(PROJECT_TYPES).toHaveLength(16);
  });

  it('чужое значение с площадки не считается известным', () => {
    // Именно поэтому колонка осталась строкой: перечисление отвергло бы это
    // значение, то есть потеряло бы то, что агент видел на объявлении.
    expect(isKnownCondition('თეთრი კარკასი')).toBe(false);
    expect(isKnownBuildingStatus('новостройка')).toBe(false);
    expect(isKnownProjectType('какой-то новый комплекс')).toBe(false);
  });

  it('свои значения известны', () => {
    expect(isKnownCondition('white_frame')).toBe(true);
    expect(isKnownBuildingStatus('new_build')).toBe(true);
    expect(isKnownProjectType('metra_park')).toBe(true);
  });
});
