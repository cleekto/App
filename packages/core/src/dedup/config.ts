import raw from '../config/duplicate-detection.json' with { type: 'json' };

/**
 * Конфигурация дедупликации.
 *
 * Значения живут в JSON рядом (требование C18), а не в коде: их калибруют
 * на размеченном наборе, и правка весов не должна быть правкой логики.
 */

export interface DedupWeights {
  ownerPhone: number;
  address: number;
  area: number;
  rooms: number;
  photos: number;
  price: number;
  floor: number;
  propertyType: number;
  totalFloors: number;
}

export type SignalField = keyof DedupWeights;

export interface DedupConfig {
  weights: DedupWeights;
  thresholds: { strong: number; possible: number };
  matching: {
    areaTolerancePercent: number;
    areaToleranceAbsolute: number;
    priceTolerancePercent: number;
    addressTrigramThreshold: number;
    minComparableFieldsForStrong: number;
  };
  candidates: { maxCandidates: number; coarseAreaTolerancePercent: number };
  agencyPhone: { propertiesThreshold: number };
}

const config: DedupConfig = {
  weights: raw.weights,
  thresholds: raw.thresholds,
  matching: raw.matching,
  candidates: raw.candidates,
  agencyPhone: raw.agencyPhone,
};

export function dedupConfig(): DedupConfig {
  return config;
}

export const SIGNAL_FIELDS: readonly SignalField[] = Object.keys(config.weights) as SignalField[];
