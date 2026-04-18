/**
 * Input-Validation Helpers — Clamping und Range-Checks für Formulare.
 */

export function clampNumber(val: number, min: number, max: number): number {
	if (!Number.isFinite(val)) return min;
	return Math.min(Math.max(val, min), max);
}

export function isInRange(val: number | null, min: number, max: number): boolean {
	if (val === null || !Number.isFinite(val)) return false;
	return val >= min && val <= max;
}

/** Standard-Ranges für Grow-Messwerte */
export const RANGES = {
	temp: { min: 0, max: 50, unit: '°C' },
	rh: { min: 0, max: 100, unit: '%' },
	vpd: { min: 0, max: 3, unit: 'kPa' },
	ec: { min: 0, max: 5, unit: 'mS/cm' },
	ph: { min: 0, max: 14, unit: '' },
	yield_g: { min: 0, max: 10000, unit: 'g' },
	plant_count: { min: 1, max: 999, unit: '' },
	week: { min: 1, max: 30, unit: '' },
	day: { min: 1, max: 7, unit: '' },
} as const;

export function validateCheckinInput(input: {
	temp: number | null;
	rh: number | null;
	ec: number | null;
	ph: number | null;
}): { valid: boolean; errors: string[] } {
	const errors: string[] = [];
	if (input.temp !== null && !isInRange(input.temp, RANGES.temp.min, RANGES.temp.max)) {
		errors.push(`Temp muss zwischen ${RANGES.temp.min}-${RANGES.temp.max}${RANGES.temp.unit} liegen`);
	}
	if (input.rh !== null && !isInRange(input.rh, RANGES.rh.min, RANGES.rh.max)) {
		errors.push(`RH muss zwischen ${RANGES.rh.min}-${RANGES.rh.max}${RANGES.rh.unit} liegen`);
	}
	if (input.ec !== null && !isInRange(input.ec, RANGES.ec.min, RANGES.ec.max)) {
		errors.push(`EC muss zwischen ${RANGES.ec.min}-${RANGES.ec.max} liegen`);
	}
	if (input.ph !== null && !isInRange(input.ph, RANGES.ph.min, RANGES.ph.max)) {
		errors.push(`pH muss zwischen ${RANGES.ph.min}-${RANGES.ph.max} liegen`);
	}
	return { valid: errors.length === 0, errors };
}
