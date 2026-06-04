/**
 * Stretch-Scaling Tests — Verifiziert v1.4.20 total_weeks-Logik
 *
 * Bei langen Strains (Sativa/Haze) wird die Peak-Woche gehalten und
 * die Fade-Wochen (kind: 'fade') ans Ende der Phase verschoben.
 */

import { describe, it, expect } from 'vitest';
import { getSchemaForWeek } from './types';
import { athenaPro } from './athena-pro';
import { athenaBlended } from './athena-blended';
import { biobizz } from './biobizz';
import { ghHybrids } from './greenhouse-feeding';
import { atamiBcuzz } from './atami-bcuzz';
import { cannaTerra } from './canna';

describe('Stretch-Scaling — Athena Pro Bloom', () => {
	it('total_weeks=9 (= schema_wochen): Schema unverändert', () => {
		const w7 = getSchemaForWeek(athenaPro, 'Bloom', 7, 9);
		expect(w7?.woche).toBe(7);
		expect(w7?.kind).toBeUndefined(); // Peak ist nicht markiert
		const w8 = getSchemaForWeek(athenaPro, 'Bloom', 8, 9);
		expect(w8?.woche).toBe(8);
		expect(w8?.kind).toBe('fade');
		const w9 = getSchemaForWeek(athenaPro, 'Bloom', 9, 9);
		expect(w9?.woche).toBe(9);
		expect(w9?.kind).toBe('fade');
	});

	it('total_weeks=12: Peak (W7) wird auf W8-W10 gehalten, Fade auf W11-W12 verschoben', () => {
		// W1-W7 = Schema W1-W7 (Aufbau + Peak)
		expect(getSchemaForWeek(athenaPro, 'Bloom', 7, 12)?.woche).toBe(7);
		// W8 = Schema W7 (Peak gehalten)
		expect(getSchemaForWeek(athenaPro, 'Bloom', 8, 12)?.woche).toBe(7);
		// W9 = Schema W7 (Peak gehalten)
		expect(getSchemaForWeek(athenaPro, 'Bloom', 9, 12)?.woche).toBe(7);
		// W10 = Schema W7 (Peak gehalten)
		expect(getSchemaForWeek(athenaPro, 'Bloom', 10, 12)?.woche).toBe(7);
		// W11 = Schema W8 (Fade-Start)
		const w11 = getSchemaForWeek(athenaPro, 'Bloom', 11, 12);
		expect(w11?.woche).toBe(8);
		expect(w11?.kind).toBe('fade');
		// W12 = Schema W9 (Fade-Ende)
		const w12 = getSchemaForWeek(athenaPro, 'Bloom', 12, 12);
		expect(w12?.woche).toBe(9);
		expect(w12?.kind).toBe('fade');
	});

	it('total_weeks=10: Peak gehalten + Fade auf W9+W10', () => {
		expect(getSchemaForWeek(athenaPro, 'Bloom', 7, 10)?.woche).toBe(7);
		// W8 = Peak halten (kein Fade noch)
		expect(getSchemaForWeek(athenaPro, 'Bloom', 8, 10)?.woche).toBe(7);
		// W9 = Schema W8 (Fade-Start)
		expect(getSchemaForWeek(athenaPro, 'Bloom', 9, 10)?.woche).toBe(8);
		// W10 = Schema W9 (Fade-Ende)
		expect(getSchemaForWeek(athenaPro, 'Bloom', 10, 10)?.woche).toBe(9);
	});

	it('Bug Reproduktion: ohne total_weeks (alte Logik) — Bloom W10 würde Schema W8 = Flush sein', () => {
		// Mit alter Logik (repeat_peak ohne kind-Berücksichtigung): rows[len-2] = W8 (Flush!)
		// Mit neuer Logik aber ohne total_weeks → fällt auf alte Logik zurück
		const oldResult = getSchemaForWeek(athenaPro, 'Bloom', 10);
		expect(oldResult?.woche).toBe(8); // alte repeat_peak Logik (vorletzte = W8)
		// Mit total_weeks: korrekt Peak halten
		const newResult = getSchemaForWeek(athenaPro, 'Bloom', 10, 12);
		expect(newResult?.woche).toBe(7); // Peak (W7) gehalten
		// Dosierung Bloom-Produkt sollte voll sein (20.3 g/10L), nicht Flush (9.4)
		expect(newResult?.dosierungen.bloom).toBe(20.3);
		expect(oldResult?.dosierungen.bloom).toBe(9.4); // alte Logik = Bug = Flush
	});
});

describe('Stretch-Scaling — GH Hybrids Bloom', () => {
	it('total_weeks=10: Ripen (W8) erscheint als W10, Peak (W7) wird gehalten', () => {
		// W7 = Schema W7 (letzte volle Bloom)
		expect(getSchemaForWeek(ghHybrids, 'Bloom', 7, 10)?.woche).toBe(7);
		// W8 = Peak gehalten (W7)
		expect(getSchemaForWeek(ghHybrids, 'Bloom', 8, 10)?.woche).toBe(7);
		// W9 = Peak gehalten (W7)
		expect(getSchemaForWeek(ghHybrids, 'Bloom', 9, 10)?.woche).toBe(7);
		// W10 = Schema W8 (Ripen)
		const w10 = getSchemaForWeek(ghHybrids, 'Bloom', 10, 10);
		expect(w10?.woche).toBe(8);
		expect(w10?.kind).toBe('fade');
	});
});

describe('Stretch-Scaling — Canna Terra Bloom', () => {
	it('total_weeks=10: Peak (W6) gehalten, Fade (W7+W8) auf W9+W10', () => {
		// W6 = letzte non-fade Woche
		expect(getSchemaForWeek(cannaTerra, 'Bloom', 6, 10)?.woche).toBe(6);
		// W7-W8 = Peak gehalten
		expect(getSchemaForWeek(cannaTerra, 'Bloom', 7, 10)?.woche).toBe(6);
		expect(getSchemaForWeek(cannaTerra, 'Bloom', 8, 10)?.woche).toBe(6);
		// W9 = Fade-Start (W7)
		expect(getSchemaForWeek(cannaTerra, 'Bloom', 9, 10)?.woche).toBe(7);
		// W10 = Fade-Ende (W8)
		expect(getSchemaForWeek(cannaTerra, 'Bloom', 10, 10)?.woche).toBe(8);
	});
});

describe('Stretch-Scaling — Atami Bloom (6W Schema)', () => {
	it('total_weeks=8: Peak (W4) gehalten, Fade (W5+W6) auf W7+W8', () => {
		// W4 = letzte non-fade Woche (offizielles Peak)
		expect(getSchemaForWeek(atamiBcuzz, 'Bloom', 4, 8)?.woche).toBe(4);
		// W5-W6 = Peak gehalten
		expect(getSchemaForWeek(atamiBcuzz, 'Bloom', 5, 8)?.woche).toBe(4);
		expect(getSchemaForWeek(atamiBcuzz, 'Bloom', 6, 8)?.woche).toBe(4);
		// W7 = Fade-Start (W5)
		const w7 = getSchemaForWeek(atamiBcuzz, 'Bloom', 7, 8);
		expect(w7?.woche).toBe(5);
		expect(w7?.kind).toBe('fade');
		// W8 = Fade-Ende (W6)
		const w8 = getSchemaForWeek(atamiBcuzz, 'Bloom', 8, 8);
		expect(w8?.woche).toBe(6);
		expect(w8?.kind).toBe('fade');
	});
});

describe('Stretch-Scaling — total_weeks < schema_wochen (kurze Strains)', () => {
	it('total_weeks=7 bei Athena 9W: Fade endet bei W7, Peak verkürzt', () => {
		// fadeStart = total_weeks - fadeRows.length + 1 = 7 - 2 + 1 = 6
		// W1-W5 = Aufbau (Schema W1-W5)
		// W6 = Fade-Start (Schema W8)
		// W7 = Fade-Ende (Schema W9)
		const w6 = getSchemaForWeek(athenaPro, 'Bloom', 6, 7);
		expect(w6?.woche).toBe(8);
		expect(w6?.kind).toBe('fade');
		const w7 = getSchemaForWeek(athenaPro, 'Bloom', 7, 7);
		expect(w7?.woche).toBe(9);
		expect(w7?.kind).toBe('fade');
	});
});

describe('Stretch-Scaling — Veg-Phase ohne fade-Markierung (Fallback)', () => {
	it('Athena Veg W5 (jenseits 4W Schema) ohne total_weeks → repeat_last', () => {
		const w5 = getSchemaForWeek(athenaPro, 'Veg', 5);
		// Stretch repeat_last → letzte Schema-Veg-Woche = W4
		expect(w5?.woche).toBe(4);
	});

	it('Athena Veg W5 mit total_weeks=8 → keine Fade-Markierungen, gibt letzte Peak-Row', () => {
		const w5 = getSchemaForWeek(athenaPro, 'Veg', 5, 8);
		// fadeRows = [] → kein Fade-Mapping → fällt in peak-Branch
		// idx = min(5-1, 4-1) = 3 → Schema W4
		expect(w5?.woche).toBe(4);
	});
});

describe('Stretch-Scaling — alte Lines ohne kind-Markierung (Backwards-Compat)', () => {
	it('BioBizz Bloom W10 ohne total_weeks → repeat_peak (vorletzte = W7)', () => {
		// W7+W8 sind als fade markiert
		const w10 = getSchemaForWeek(biobizz, 'Bloom', 10);
		// Direkter Match fehlt → fadeRows existieren → aber total_weeks fehlt → alte Stretch-Logik
		// rows.length=8, rows.length-2 = rows[6] = W7
		expect(w10?.woche).toBe(7);
	});
});

describe('Stretch-Scaling — Direkter Match hat Priorität', () => {
	it('Athena Bloom W3 mit total_weeks=12 → Schema W3 (unverändert)', () => {
		// W3 < fadeStart (=11) → idx = min(2, peakRows.length-1=6) = 2 → peakRows[2] = W3
		const w3 = getSchemaForWeek(athenaPro, 'Bloom', 3, 12);
		expect(w3?.woche).toBe(3);
	});
});
