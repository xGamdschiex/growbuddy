/**
 * AutoPot Athena v3 - EC Unit Conversion
 * Bidirectional conversion between mS/cm, ppm500, ppm700
 */

export type ECEinheit = 'mS/cm' | 'ppm500' | 'ppm700';

/** Multiplication factor to convert FROM mS/cm TO the given unit */
const UNIT_FACTORS: Record<ECEinheit, number> = {
  'mS/cm': 1,
  'ppm500': 500,
  'ppm700': 700,
};

/** Convert an EC value from mS/cm to the target unit */
export function fromMsPerCm(ec_ms: number, target: ECEinheit): number {
  return ec_ms * UNIT_FACTORS[target];
}

/** Convert an EC value from a source unit to mS/cm */
export function toMsPerCm(ec_value: number, source: ECEinheit): number {
  return ec_value / UNIT_FACTORS[source];
}

/** Convert between any two units */
export function convertEC(value: number, from: ECEinheit, to: ECEinheit): number {
  const ms = toMsPerCm(value, from);
  return fromMsPerCm(ms, to);
}

/** Get the display factor for a unit (for sheet compatibility) */
export function unitFactor(unit: ECEinheit): number {
  return UNIT_FACTORS[unit];
}

/** Format EC value with unit label */
export function formatEC(value: number, unit: ECEinheit): string {
  if (unit === 'mS/cm') {
    return `${round(value, 2)} mS/cm`;
  }
  return `${Math.round(value)} ${unit}`;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
