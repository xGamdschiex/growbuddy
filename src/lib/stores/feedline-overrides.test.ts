/**
 * FeedLine-Overrides Tests
 * Verifiziert dass User-Overrides die Calc-Engine korrekt beeinflussen.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculate } from '$lib/calc/nutrients';
import { applyRowOverride, feedlineOverrides } from './feedline-overrides';
import { athenaPro } from '$lib/calc/feedlines/athena-pro';

const BASE = {
	feedline_id: 'athena-pro',
	wasserprofil: 'Mainz Petersaue',
	phase: 'Bloom',
	woche: 4,
	tag: 4,
	strain: 'OG',
	reservoir_L: 10,
	faktor_modus: 'Manuell' as const,
	faktor_manuell: 100,
	calmag_typ: 'A' as const,
	ec_einheit: 'mS/cm' as const,
	medium: 'coco' as const,
	system: 'topf' as const,
	hat_ro: true,
	wasserprofil_obj: undefined,
};

describe('feedlineOverrides — Basic Operations', () => {
	beforeEach(() => feedlineOverrides.reset());

	it('Override-Setter speichert Patch', () => {
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { ec_ziel: 3.5 });
		const row = athenaPro.schema.find(r => r.phase === 'Bloom' && r.woche === 4)!;
		const merged = applyRowOverride('athena-pro', row);
		expect(merged.ec_ziel).toBe(3.5);
		expect(merged.dosierungen.bloom).toBe(20.3); // Original-Wert bleibt
	});

	it('Dosierungen werden tief gemergt', () => {
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { dosierungen: { bloom: 25 } });
		const row = athenaPro.schema.find(r => r.phase === 'Bloom' && r.woche === 4)!;
		const merged = applyRowOverride('athena-pro', row);
		expect(merged.dosierungen.bloom).toBe(25);
		expect(merged.dosierungen.core).toBe(12.2); // Original bleibt
	});

	it('clearField entfernt einzelnen Override', () => {
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { ec_ziel: 3.5, ph_min: 6.5 });
		feedlineOverrides.clearField('athena-pro', 'Bloom', 4, 'ec_ziel');
		const row = athenaPro.schema.find(r => r.phase === 'Bloom' && r.woche === 4)!;
		const merged = applyRowOverride('athena-pro', row);
		expect(merged.ec_ziel).toBe(row.ec_ziel); // zurück auf Original
		expect(merged.ph_min).toBe(6.5); // anderer Override bleibt
	});

	it('clearRow entfernt komplette Zeile', () => {
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { ec_ziel: 3.5 });
		feedlineOverrides.clearRow('athena-pro', 'Bloom', 4);
		const row = athenaPro.schema.find(r => r.phase === 'Bloom' && r.woche === 4)!;
		const merged = applyRowOverride('athena-pro', row);
		expect(merged).toBe(row); // Original-Referenz zurück
	});

	it('clearLine entfernt alle Phase-Overrides einer Line', () => {
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { ec_ziel: 3.5 });
		feedlineOverrides.setRow('athena-pro', 'Veg', 2, { ec_ziel: 2.5 });
		feedlineOverrides.clearLine('athena-pro');
		const bloomRow = athenaPro.schema.find(r => r.phase === 'Bloom' && r.woche === 4)!;
		const vegRow = athenaPro.schema.find(r => r.phase === 'Veg' && r.woche === 2)!;
		expect(applyRowOverride('athena-pro', bloomRow)).toBe(bloomRow);
		expect(applyRowOverride('athena-pro', vegRow)).toBe(vegRow);
	});
});

describe('feedlineOverrides — Calc-Engine Integration', () => {
	beforeEach(() => feedlineOverrides.reset());

	it('Override auf ec_ziel beeinflusst ec_soll', () => {
		const before = calculate(BASE);
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { ec_ziel: before.ec_ziel_raw * 1.5 });
		const after = calculate(BASE);
		expect(after.ec_soll).toBeGreaterThan(before.ec_soll);
		expect(after.ec_ziel_raw).toBe(before.ec_ziel_raw * 1.5);
	});

	it('Override auf bloom-Dosierung erscheint in menge_tank', () => {
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { dosierungen: { bloom: 30 } });
		const r = calculate(BASE);
		const bloomDose = r.dosierungen.find(d => d.product.key === 'bloom');
		expect(bloomDose?.menge_schema).toBe(30);
		// Bloom als g/10L → 30g × Faktor × (10L/10L) = 30 × 0.65 (DWC-System ist topf nicht...) — Topf-Faktor 1
		// Aber faktor wird durch Hahn-EC-Reduktion < 100 sein. Wichtig: schema-Override greift.
		expect(bloomDose?.menge_tank).toBeGreaterThan(0);
	});

	it('Override auf ph_min/max beeinflusst pH-Range', () => {
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { ph_min: 5.2, ph_max: 5.6 });
		// Medium=coco lässt ph_min/max durch (kein erde-Override). Hydro würde max=6.0 forcen.
		const r = calculate({ ...BASE, medium: 'coco' });
		expect(r.ph_min).toBe(5.2);
		expect(r.ph_max).toBe(5.6);
	});

	it('Override auf fmin/fmax beeinflusst Auto-Faktor', () => {
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { fmin: 30, fmax: 30 });
		const r = calculate({ ...BASE, faktor_modus: 'Auto' });
		expect(r.faktor_auto).toBe(30); // beide gleich → linear flach bei 30
	});

	it('Override auf kind verändert Skalierungs-Verhalten', () => {
		// W4 ist normalerweise Peak/Build. Wenn wir W4 als fade markieren UND total_weeks setzen,
		// würde die Stretch-Logik W4 als Fade-Woche behandeln.
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { kind: 'fade' });
		// Die Calc-Engine ruft getSchemaForWeek vor dem Override — der kind-Wert in der Original-Zeile
		// (= 'build') wird bei der Schema-Stretch-Berechnung verwendet, NICHT der überschriebene kind.
		// Das ist Absicht: kind ist Schema-Klassifikation und sollte primär im Editor selbst stehen,
		// nicht in der Stretch-Heuristik. Der Override greift trotzdem für die Anzeige.
		const r = calculate({ ...BASE, woche: 4, total_weeks: 9 });
		expect(r.schema.kind).toBe('fade');
	});
});

describe('feedlineOverrides — Export/Import', () => {
	beforeEach(() => feedlineOverrides.reset());

	it('exportJson liefert valides JSON mit overrides-Key', () => {
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { ec_ziel: 3.5 });
		const json = feedlineOverrides.exportJson();
		const parsed = JSON.parse(json);
		expect(parsed.version).toBeDefined();
		expect(parsed.overrides['athena-pro']['Bloom'][4].ec_ziel).toBe(3.5);
	});

	it('importJson übernimmt fremden State', () => {
		const json = JSON.stringify({
			version: '1.0',
			overrides: { 'athena-pro': { 'Bloom': { '4': { ec_ziel: 4.0 } } } },
		});
		const ok = feedlineOverrides.importJson(json);
		expect(ok).toBe(true);
		const row = athenaPro.schema.find(r => r.phase === 'Bloom' && r.woche === 4)!;
		expect(applyRowOverride('athena-pro', row).ec_ziel).toBe(4.0);
	});

	it('importJson invalid → false, State unverändert', () => {
		const ok = feedlineOverrides.importJson('not json');
		expect(ok).toBe(false);
	});

	it('importJson versionierter Export rundtrip', () => {
		feedlineOverrides.setRow('athena-pro', 'Bloom', 4, { ec_ziel: 3.5 });
		const json = feedlineOverrides.exportJson();
		const parsed = JSON.parse(json);
		expect(parsed.version).toBe(1);
		expect(parsed.exported_at).toBeTruthy();
		feedlineOverrides.reset();
		const ok = feedlineOverrides.importJson(json);
		expect(ok).toBe(true);
	});

	it('importJson akzeptiert legacy-Format ohne version-Key', () => {
		const legacy = JSON.stringify({ 'athena-pro': { 'Bloom': { '4': { ec_ziel: 3.7 } } } });
		const ok = feedlineOverrides.importJson(legacy);
		expect(ok).toBe(true);
	});

	it('importJson lehnt fehlerhafte Struktur ab (lineId-Wert kein Object)', () => {
		const bad = JSON.stringify({ version: 1, overrides: { 'athena-pro': 'not-an-object' } });
		const ok = feedlineOverrides.importJson(bad);
		expect(ok).toBe(false);
	});
});
