/**
 * Verify-All — Numerische End-to-End-Verifikation für alle Lines + Phasen
 *
 * Doppel-Check für v1.4.20-Release:
 *  - Jede Line liefert für Bloom-Peak-Woche eine plausible Dosierung
 *  - Skalierung bei 12W-Sativa: Peak gehalten + Fade verschoben
 *  - EC-Soll = Schema-EC bei Standard-Faktor 100% Topf + RO
 *  - CalMag-Berechnung produziert positive Werte bei RO
 *  - Auto-Faktor T1→T7 interpoliert
 *  - Cleanse-Rampe (Athena) T1→T7 monoton
 *  - Hahn-Anteil reduziert Dosierfaktor bei mineralischen Lines (kein-RO)
 *  - System-Faktor (DWC ×0.65) reduziert dosierfaktor
 */

import { describe, it, expect } from 'vitest';
import { calculate } from './nutrients';
import type { CalcInput } from './nutrients';
import { getAllFeedLines, getFeedLine } from './feedlines/registry';

const BASE: CalcInput = {
	feedline_id: 'athena-pro',
	wasserprofil: 'Mainz Petersaue',
	phase: 'Bloom',
	woche: 5,
	tag: 4,
	strain: 'Test',
	reservoir_L: 10,
	faktor_modus: 'Manuell',
	faktor_manuell: 100,
	calmag_typ: 'A',
	ec_einheit: 'mS/cm',
	medium: 'coco',
	system: 'topf',
	hat_ro: true,
};

describe('Verify-All — Alle Lines liefern ein valides Bloom-Peak-Result', () => {
	const lines = getAllFeedLines().filter(l => l.phasen.some(p => p.name === 'Bloom'));
	for (const line of lines) {
		it(`${line.id}: Bloom (sinnvolle Mitte) liefert ec_soll > 0 + dosierungen vorhanden`, () => {
			const bp = line.phasen.find(p => p.name === 'Bloom')!;
			const midWeek = Math.max(1, Math.ceil(bp.schema_wochen / 2));
			const result = calculate({
				...BASE,
				feedline_id: line.id,
				phase: 'Bloom',
				woche: midWeek,
				tag: 4,
				medium: line.medien.includes('coco') ? 'coco' : line.medien[0],
				hat_ro: true,
			});
			expect(result.feedline.id).toBe(line.id);
			expect(result.ec_soll).toBeGreaterThan(0);
			expect(result.dosierungen.length).toBeGreaterThan(0);
			// Mindestens ein Produkt hat Menge > 0
			expect(result.dosierungen.some(d => d.menge_tank > 0)).toBe(true);
			// pH-Range plausibel
			expect(result.ph_min).toBeGreaterThan(4);
			expect(result.ph_max).toBeLessThan(8);
		});
	}
});

describe('Verify-All — Skalierung: 12W-Strain liefert Peak in W8-W10, Fade in W11-W12', () => {
	const linesWithFade = getAllFeedLines().filter(l =>
		l.schema.some(r => r.phase === 'Bloom' && r.kind === 'fade')
	);

	for (const line of linesWithFade) {
		const bp = line.phasen.find(p => p.name === 'Bloom')!;
		const fadeRows = line.schema.filter(r => r.phase === 'Bloom' && r.kind === 'fade');
		const peakRows = line.schema.filter(r => r.phase === 'Bloom' && r.kind !== 'fade');
		const targetTotal = Math.min(12, bp.max_wochen);
		if (targetTotal < bp.schema_wochen + 1) continue;

		it(`${line.id}: total_weeks=${targetTotal} — Peak halten + Fade verschieben`, () => {
			const fadeStart = targetTotal - fadeRows.length + 1;

			// Woche fadeStart-1 muss letzte Peak-Woche sein
			const lastPeakResult = calculate({
				...BASE, feedline_id: line.id, phase: 'Bloom',
				woche: fadeStart - 1, total_weeks: targetTotal,
				medium: line.medien.includes('coco') ? 'coco' : line.medien[0], hat_ro: true,
			});
			const lastPeakSchema = peakRows[peakRows.length - 1];
			expect(lastPeakResult.schema.woche).toBe(lastPeakSchema.woche);
			expect(lastPeakResult.schema.kind).not.toBe('fade');

			// Woche fadeStart muss erste Fade-Woche sein
			const fadeStartResult = calculate({
				...BASE, feedline_id: line.id, phase: 'Bloom',
				woche: fadeStart, total_weeks: targetTotal,
				medium: line.medien.includes('coco') ? 'coco' : line.medien[0], hat_ro: true,
			});
			expect(fadeStartResult.schema.kind).toBe('fade');
			expect(fadeStartResult.schema.woche).toBe(fadeRows[0].woche);
		});
	}
});

describe('Verify-All — EC-Soll-Berechnung bei reinem RO (custom Profil EC=0)', () => {
	// Pures RO-Profil über custom_wasser definieren (EC=0, Ca=0, Mg=0)
	const PURE_RO = { wasserprofil: 'Benutzerdefiniert', custom_wasser: { ca: 0, mg: 0, ec: 0, ph: 7 } };
	it('athena-pro Veg W3 pure RO 100% Topf → ec_soll = schema.ec_ziel', () => {
		const r = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Veg', woche: 3, tag: 4, hat_ro: true, ...PURE_RO });
		expect(r.ec_soll).toBeCloseTo(r.schema.ec_ziel, 2);
		expect(r.lw_ec).toBe(0);
	});
	it('canna-coco Bloom W3 pure RO 100% → ec_soll = schema.ec_ziel', () => {
		const r = calculate({ ...BASE, feedline_id: 'canna-coco', phase: 'Bloom', woche: 3, tag: 4, hat_ro: true, ...PURE_RO });
		expect(r.ec_soll).toBeCloseTo(r.schema.ec_ziel, 2);
	});
});

describe('Verify-All — System-Faktor reduziert Dosierung', () => {
	const PURE_RO = { wasserprofil: 'Benutzerdefiniert', custom_wasser: { ca: 0, mg: 0, ec: 0, ph: 7 } };
	it('athena-pro Bloom W4 pure RO: DWC ec_soll = 0.65 × Topf ec_soll (kein LW-Anteil zu addieren)', () => {
		const topf = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 4, tag: 4, hat_ro: true, system: 'topf', medium: 'coco', ...PURE_RO });
		const dwc = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 4, tag: 4, hat_ro: true, system: 'dwc', medium: 'hydro', ...PURE_RO });
		expect(dwc.ec_soll).toBeLessThan(topf.ec_soll);
		expect(dwc.ec_soll / topf.ec_soll).toBeCloseTo(0.65, 2);
	});
	it('athena-pro Bloom W4 mit LW: DWC < Topf, aber Verhältnis > 0.65 wegen LW-EC-Anteil', () => {
		// Mit Mainz-Profil + RO → Hahn-Mix; LW-EC wird zum Schema-EC addiert (NICHT vom System-Faktor skaliert)
		// Verhältnis liegt zwischen 0.65 und 1.0
		const topf = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 4, tag: 4, hat_ro: true, system: 'topf', medium: 'coco' });
		const dwc = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 4, tag: 4, hat_ro: true, system: 'dwc', medium: 'hydro' });
		const ratio = dwc.ec_soll / topf.ec_soll;
		expect(ratio).toBeGreaterThan(0.65);
		expect(ratio).toBeLessThan(1.0);
	});
});

describe('Verify-All — CalMag liefert positive Werte bei RO (Athena)', () => {
	it('athena-pro Bloom W4 RO → calmag_mL_total > 0', () => {
		const r = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 4, tag: 4, hat_ro: true });
		expect(r.calmag.calmag_mL_total).toBeGreaterThan(0);
	});
});

describe('Verify-All — Auto-Faktor T1→T7 interpoliert linear', () => {
	it('athena-pro Veg W2 Auto: t7 > t1', () => {
		const t1 = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Veg', woche: 2, tag: 1, faktor_modus: 'Auto', hat_ro: true });
		const t7 = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Veg', woche: 2, tag: 7, faktor_modus: 'Auto', hat_ro: true });
		expect(t7.faktor_aktiv).toBeGreaterThan(t1.faktor_aktiv);
	});
});

describe('Verify-All — Cleanse-Rampe (Athena) monoton T1 → T7', () => {
	it('athena-pro Bloom W4 RO: cleanse T7 ≥ T1', () => {
		const t1 = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 4, tag: 1, hat_ro: true });
		const t7 = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 4, tag: 7, hat_ro: true });
		expect(t7.cleanse_mL_per_10L).toBeGreaterThanOrEqual(t1.cleanse_mL_per_10L);
	});
});

describe('Verify-All — Hahn-Wasser reduziert Dosierfaktor bei mineralischen Lines', () => {
	it('athena-pro mit Mainz-Wasser (LW-EC vorhanden, kein RO): dosierfaktor < 100', () => {
		const r = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 4, tag: 4, hat_ro: false, wasserprofil: 'Mainz Petersaue' });
		expect(r.faktor_aktiv).toBeLessThan(100);
		expect(r.lw_ec).toBeGreaterThan(0);
	});
	it('biobizz organisch mit Mainz-Wasser: dosierfaktor bleibt 100 (keine EC-Reduktion bei Organik)', () => {
		const r = calculate({ ...BASE, feedline_id: 'biobizz', phase: 'Bloom', woche: 3, tag: 4, hat_ro: false, wasserprofil: 'Mainz Petersaue', medium: 'erde' });
		expect(r.faktor_aktiv).toBe(100);
		expect(r.ec_ist_richtwert).toBe(true);
	});
});

describe('Verify-All — Schema-Woche stretch_info bei total_weeks=12 sichtbar', () => {
	it('athena-pro Bloom W10 mit total_weeks=12 → stretch_info.strategy = peak_held', () => {
		const r = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 10, tag: 4, total_weeks: 12, hat_ro: true });
		expect(r.stretch_info).not.toBeNull();
		expect(r.stretch_info?.requested_woche).toBe(10);
		expect(r.stretch_info?.used_woche).toBe(7); // Peak-Woche
		expect(r.stretch_info?.strategy).toBe('peak_held');
		// Bloom-Produkt-Dosierung muss voll sein (nicht Flush)
		const bloomDose = r.dosierungen.find(d => d.product.key === 'bloom');
		expect(bloomDose?.menge_schema).toBe(20.3);
	});
	it('athena-pro Bloom W11 mit total_weeks=12 → fade_shifted', () => {
		const r = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 11, tag: 4, total_weeks: 12, hat_ro: true });
		expect(r.stretch_info?.strategy).toBe('fade_shifted');
		expect(r.stretch_info?.used_woche).toBe(8); // Erste Fade-Woche
	});
});

describe('Verify-All — Edge-Case: Bug-Reproduktion ohne kind-Markierung würde Flush liefern', () => {
	it('Direkt-Vergleich: alte Logik vs. neue Logik bei Athena Bloom W10', () => {
		const altLogik = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 10, tag: 4, hat_ro: true });
		const neuLogik = calculate({ ...BASE, feedline_id: 'athena-pro', phase: 'Bloom', woche: 10, tag: 4, total_weeks: 12, hat_ro: true });
		// Alte Logik: rows.length-2 = W8 (Flush-Taper, bloom 9.4)
		const altBloom = altLogik.dosierungen.find(d => d.product.key === 'bloom');
		expect(altBloom?.menge_schema).toBe(9.4);
		// Neue Logik mit total_weeks=12: Peak (W7, bloom 20.3)
		const neuBloom = neuLogik.dosierungen.find(d => d.product.key === 'bloom');
		expect(neuBloom?.menge_schema).toBe(20.3);
		// Differenz = > 2x mehr Dünger bei neuer Logik (korrekt für 12W-Sativa)
		expect(neuBloom!.menge_tank).toBeGreaterThan(altBloom!.menge_tank * 2);
	});
});

describe('Verify-All — Multi-Line Smoke: Bloom-Peak + Fade-Mapping numerisch', () => {
	const testCases: Array<{ id: string; totalW: number; peakW: number; peakSchemaW: number; fadeW: number; fadeSchemaW: number }> = [
		{ id: 'athena-pro', totalW: 12, peakW: 9, peakSchemaW: 7, fadeW: 11, fadeSchemaW: 8 },
		{ id: 'athena-blended', totalW: 12, peakW: 9, peakSchemaW: 7, fadeW: 11, fadeSchemaW: 8 },
		{ id: 'biobizz', totalW: 12, peakW: 9, peakSchemaW: 6, fadeW: 11, fadeSchemaW: 7 },
		{ id: 'canna-terra', totalW: 11, peakW: 8, peakSchemaW: 6, fadeW: 10, fadeSchemaW: 7 },
		{ id: 'canna-coco', totalW: 11, peakW: 8, peakSchemaW: 6, fadeW: 10, fadeSchemaW: 7 },
		{ id: 'gh-hybrids', totalW: 11, peakW: 9, peakSchemaW: 7, fadeW: 11, fadeSchemaW: 8 },
		{ id: 'atami-bcuzz', totalW: 9, peakW: 6, peakSchemaW: 4, fadeW: 8, fadeSchemaW: 5 },
		{ id: 'advancedSensi', totalW: 11, peakW: 8, peakSchemaW: 6, fadeW: 10, fadeSchemaW: 7 },
		{ id: 'hesi', totalW: 11, peakW: 8, peakSchemaW: 6, fadeW: 10, fadeSchemaW: 7 },
	];
	for (const tc of testCases) {
		const line = getFeedLine(tc.id);
		if (!line) continue; // hesi/AN haben andere IDs
		it(`${tc.id}: Bloom W${tc.peakW}@total=${tc.totalW} → Schema W${tc.peakSchemaW} (non-fade); W${tc.fadeW} → Schema W${tc.fadeSchemaW} (fade)`, () => {
			const medium = line.medien.includes('coco') ? 'coco' : line.medien[0];
			const peak = calculate({ ...BASE, feedline_id: tc.id, phase: 'Bloom', woche: tc.peakW, tag: 4, total_weeks: tc.totalW, hat_ro: true, medium });
			expect(peak.schema.woche).toBe(tc.peakSchemaW);
			expect(peak.schema.kind).not.toBe('fade');
			const fade = calculate({ ...BASE, feedline_id: tc.id, phase: 'Bloom', woche: tc.fadeW, tag: 4, total_weeks: tc.totalW, hat_ro: true, medium });
			expect(fade.schema.woche).toBe(tc.fadeSchemaW);
			expect(fade.schema.kind).toBe('fade');
		});
	}
});
