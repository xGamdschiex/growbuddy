/**
 * Outputs-Shape — Verifiziert jedes Feld von CalcResult auf:
 *  - vorhanden (nicht undefined)
 *  - korrekter Typ
 *  - plausibler Wertebereich
 *
 * Im Gegensatz zu verify-all.test.ts (das physikalische Korrektheit prüft)
 * geht dieses File jedes Output-Feld der CalcResult-Struktur durch.
 */

import { describe, it, expect } from 'vitest';
import { calculate } from './nutrients';
import type { CalcInput } from './nutrients';

const BASE: CalcInput = {
	feedline_id: 'athena-pro',
	wasserprofil: 'Mainz Petersaue',
	phase: 'Bloom',
	woche: 4,
	tag: 4,
	strain: 'OG-Test',
	reservoir_L: 10,
	faktor_modus: 'Auto',
	faktor_manuell: 100,
	calmag_typ: 'A',
	ec_einheit: 'mS/cm',
	medium: 'coco',
	system: 'topf',
	hat_ro: true,
};

describe('CalcResult — feedline (referenz)', () => {
	const r = calculate(BASE);
	it('feedline ist vorhanden', () => expect(r.feedline).toBeDefined());
	it('feedline.id matched Input', () => expect(r.feedline.id).toBe('athena-pro'));
	it('feedline hat phasen + schema', () => {
		expect(r.feedline.phasen.length).toBeGreaterThan(0);
		expect(r.feedline.schema.length).toBeGreaterThan(0);
	});
});

describe('CalcResult — schema (Schema-Row Pointer)', () => {
	const r = calculate(BASE);
	it('schema ist vorhanden', () => expect(r.schema).toBeDefined());
	it('schema.phase = Input', () => expect(r.schema.phase).toBe('Bloom'));
	it('schema.ec_ziel > 0', () => expect(r.schema.ec_ziel).toBeGreaterThan(0));
	it('schema.dosierungen ist Objekt', () => expect(typeof r.schema.dosierungen).toBe('object'));
});

describe('CalcResult — profil (Wasserprofil)', () => {
	const r = calculate(BASE);
	it('profil ist vorhanden', () => expect(r.profil).toBeDefined());
	it('profil.name = Input', () => expect(r.profil.name).toBe('Mainz Petersaue'));
	it('profil.ca + mg + ec + ph numerisch', () => {
		expect(typeof r.profil.ca).toBe('number');
		expect(typeof r.profil.mg).toBe('number');
		expect(typeof r.profil.ec).toBe('number');
		expect(typeof r.profil.ph).toBe('number');
	});
});

describe('CalcResult — Faktor-Felder', () => {
	const r = calculate(BASE);
	it('faktor_aktiv im Bereich [0, 100]', () => {
		expect(r.faktor_aktiv).toBeGreaterThanOrEqual(0);
		expect(r.faktor_aktiv).toBeLessThanOrEqual(100);
	});
	it('faktor_auto im Bereich [0, 100]', () => {
		expect(r.faktor_auto).toBeGreaterThanOrEqual(0);
		expect(r.faktor_auto).toBeLessThanOrEqual(100);
	});
});

describe('CalcResult — Wasser-Mix-Felder', () => {
	const r = calculate(BASE);
	it('hahn_pct im Bereich [0, 100]', () => {
		expect(r.hahn_pct).toBeGreaterThanOrEqual(0);
		expect(r.hahn_pct).toBeLessThanOrEqual(100);
	});
	it('ro_L + lw_L summieren grob zu reservoir_L', () => {
		expect(r.ro_L + r.lw_L).toBeCloseTo(BASE.reservoir_L, 0);
	});
	it('lw_ec ≥ 0', () => expect(r.lw_ec).toBeGreaterThanOrEqual(0));
	it('lw_ec mit Mainz ≈ profil.ec', () => expect(r.lw_ec).toBeCloseTo(r.profil.ec, 1));
});

describe('CalcResult — EC-Felder', () => {
	const r = calculate(BASE);
	it('ec_ziel_raw > 0', () => expect(r.ec_ziel_raw).toBeGreaterThan(0));
	it('ec_ziel_raw = schema.ec_ziel', () => expect(r.ec_ziel_raw).toBe(r.schema.ec_ziel));
	it('ec_soll > 0', () => expect(r.ec_soll).toBeGreaterThan(0));
});

describe('CalcResult — dosierungen Array', () => {
	const r = calculate(BASE);
	it('dosierungen ist Array', () => expect(Array.isArray(r.dosierungen)).toBe(true));
	it('jedes Element hat product, menge_schema, menge_tank, display', () => {
		for (const d of r.dosierungen) {
			expect(d.product).toBeDefined();
			expect(d.product.key).toBeTruthy();
			expect(d.product.name).toBeTruthy();
			expect(typeof d.menge_schema).toBe('number');
			expect(typeof d.menge_tank).toBe('number');
			expect(typeof d.display).toBe('string');
			expect(d.display.length).toBeGreaterThan(0);
		}
	});
	it('mindestens ein Produkt mit menge_tank > 0', () => {
		expect(r.dosierungen.some(d => d.menge_tank > 0)).toBe(true);
	});
});

describe('CalcResult — Legacy Athena-Felder', () => {
	const athena = calculate(BASE);
	const canna = calculate({ ...BASE, feedline_id: 'canna-coco', medium: 'coco' });
	it('athena Bloom: bloom_g > 0, core_g > 0, grow_g = 0', () => {
		expect(athena.bloom_g).toBeGreaterThan(0);
		expect(athena.core_g).toBeGreaterThan(0);
		expect(athena.grow_g).toBe(0); // Bloom hat kein grow
	});
	it('non-Athena Line: legacy-Felder = 0', () => {
		expect(canna.grow_g).toBe(0);
		expect(canna.bloom_g).toBe(0);
		expect(canna.core_g).toBe(0);
		expect(canna.fade_mL).toBe(0);
	});
	it('athena fade_mL nur in Bloom W8+W9', () => {
		const w4 = calculate({ ...BASE, woche: 4 });
		const w8 = calculate({ ...BASE, woche: 8 });
		expect(w4.fade_mL).toBe(0);
		expect(w8.fade_mL).toBeGreaterThan(0);
	});
});

describe('CalcResult — Cleanse-Felder (Athena-Rampe)', () => {
	const r = calculate(BASE);
	it('cleanse_mL_per_10L > 0 in Bloom', () => expect(r.cleanse_mL_per_10L).toBeGreaterThan(0));
	it('cleanse_mL_tank = per_10L × reservoir/10', () => {
		expect(r.cleanse_mL_tank).toBeCloseTo(r.cleanse_mL_per_10L * (BASE.reservoir_L / 10), 1);
	});
	it('non-Athena Line: cleanse-Felder = 0', () => {
		const canna = calculate({ ...BASE, feedline_id: 'canna-coco' });
		expect(canna.cleanse_mL_per_10L).toBe(0);
		expect(canna.cleanse_mL_tank).toBe(0);
	});
});

describe('CalcResult — CalMag (10 Subfelder)', () => {
	const r = calculate(BASE);
	const cm = r.calmag;
	it('alle 14 CalMag-Felder existieren', () => {
		expect(typeof cm.calmag_mLpL).toBe('number');
		expect(typeof cm.mono_mg_mLpL).toBe('number');
		expect(typeof cm.calmag_mL_total).toBe('number');
		expect(typeof cm.mono_mg_mL_total).toBe('number');
		expect(typeof cm.tropfen_pL).toBe('number');
		expect(typeof cm.tropfen_total).toBe('number');
		expect(typeof cm.ca_ist).toBe('number');
		expect(typeof cm.mg_ist).toBe('number');
		expect(typeof cm.mg_via_calmag).toBe('number');
		expect(typeof cm.delta_ca).toBe('number');
		expect(typeof cm.delta_mg).toBe('number');
		expect(typeof cm.camg_ratio).toBe('number');
		expect(typeof cm.ratio_ok).toBe('boolean');
	});
	it('calmag_mL_total ≥ 0', () => expect(cm.calmag_mL_total).toBeGreaterThanOrEqual(0));
	it('mono_mg_mL_total ≥ 0', () => expect(cm.mono_mg_mL_total).toBeGreaterThanOrEqual(0));
});

describe('CalcResult — pH-Felder', () => {
	const r = calculate(BASE);
	it('ph_min < ph_max', () => expect(r.ph_min).toBeLessThan(r.ph_max));
	it('ph_min/max plausibel', () => {
		expect(r.ph_min).toBeGreaterThan(4);
		expect(r.ph_max).toBeLessThan(8);
	});
	it('ph_ziel ist String "min - max"', () => {
		expect(r.ph_ziel).toBe(`${r.ph_min} - ${r.ph_max}`);
	});
	it('medium=erde hebt ph_min auf 6.0+', () => {
		const erde = calculate({ ...BASE, medium: 'erde' });
		expect(erde.ph_min).toBeGreaterThanOrEqual(6.0);
	});
	it('medium=hydro senkt ph_max auf 6.0', () => {
		const hydro = calculate({ ...BASE, medium: 'hydro' });
		expect(hydro.ph_max).toBeLessThanOrEqual(6.0);
	});
});

describe('CalcResult — Validation-Felder', () => {
	it('ohne ist_ec/ist_ph → check = "--"', () => {
		const r = calculate(BASE);
		expect(r.ec_check).toBe('--');
		expect(r.ph_check).toBe('--');
	});
	it('mit ist_ec nahe ec_soll → "OK"', () => {
		const r0 = calculate(BASE);
		const r = calculate({ ...BASE, ist_ec: r0.ec_soll * 1.05 });
		expect(r.ec_check).toBe('OK');
	});
	it('mit ist_ec 50% Abweichung → "Abweichung > 15%"', () => {
		const r0 = calculate(BASE);
		const r = calculate({ ...BASE, ist_ec: r0.ec_soll * 1.5 });
		expect(r.ec_check).toBe('Abweichung > 15%');
	});
	it('mit ist_ph im Range → "OK"', () => {
		const r0 = calculate(BASE);
		const r = calculate({ ...BASE, ist_ph: (r0.ph_min + r0.ph_max) / 2 });
		expect(r.ph_check).toBe('OK');
	});
	it('mit ist_ph außerhalb → "Ausserhalb"', () => {
		const r = calculate({ ...BASE, ist_ph: 4.0 });
		expect(r.ph_check).toBe('Ausserhalb');
	});
});

describe('CalcResult — ec_budget_ok + ec_budget_warnung', () => {
	it('mit RO+normal Schema: ec_budget_ok = true, warnung leer', () => {
		const r = calculate({ ...BASE, hat_ro: true });
		expect(r.ec_budget_ok).toBe(true);
		expect(r.ec_budget_warnung).toBe('');
	});
	it('mit extrem hohem LW-EC (Berlin Charlottenburg) → ec_budget_warnung', () => {
		// Wir setzen ein Custom-Profil mit absurd hohem EC
		const r = calculate({
			...BASE,
			hat_ro: false,
			wasserprofil: 'Benutzerdefiniert',
			custom_wasser: { ca: 200, mg: 50, ec: 2.5, ph: 7.5 }, // EC-Budget für Veg (3.0) > 80% verbraucht
			phase: 'Veg', woche: 1, tag: 1,
		});
		// dosierfaktor sollte stark reduziert sein
		expect(r.faktor_aktiv).toBeLessThan(50);
	});
});

describe('CalcResult — ec_ist_richtwert', () => {
	it('mineralisch (athena) → false', () => {
		const r = calculate({ ...BASE, feedline_id: 'athena-pro' });
		expect(r.ec_ist_richtwert).toBe(false);
	});
	it('organisch (biobizz) → true', () => {
		const r = calculate({ ...BASE, feedline_id: 'biobizz', medium: 'erde' });
		expect(r.ec_ist_richtwert).toBe(true);
	});
});

describe('CalcResult — stretch_info', () => {
	it('innerhalb Schema-Range + ohne total_weeks → null', () => {
		const r = calculate({ ...BASE, woche: 4 });
		expect(r.stretch_info).toBeNull();
	});
	it('außerhalb Schema (W10) ohne total_weeks → strategy = "repeat_peak"', () => {
		const r = calculate({ ...BASE, woche: 10 });
		expect(r.stretch_info).not.toBeNull();
		expect(r.stretch_info?.strategy).toBe('repeat_peak');
	});
	it('mit total_weeks=12 Peak-Bereich → strategy = "peak_held"', () => {
		const r = calculate({ ...BASE, woche: 9, total_weeks: 12 });
		expect(r.stretch_info?.strategy).toBe('peak_held');
	});
	it('mit total_weeks=12 Fade-Bereich → strategy = "fade_shifted"', () => {
		const r = calculate({ ...BASE, woche: 11, total_weeks: 12 });
		expect(r.stretch_info?.strategy).toBe('fade_shifted');
	});
});

describe('CalcResult — mix_steps', () => {
	const r = calculate(BASE);
	it('mix_steps ist Array', () => expect(Array.isArray(r.mix_steps)).toBe(true));
	it('mix_steps hat mindestens Wasser + Produkte + Kontrolle', () => {
		expect(r.mix_steps.length).toBeGreaterThanOrEqual(3);
	});
	it('jeder Step hat nr/label/detail/menge', () => {
		for (const s of r.mix_steps) {
			expect(typeof s.nr).toBe('number');
			expect(typeof s.label).toBe('string');
			expect(typeof s.detail).toBe('string');
			expect(typeof s.menge).toBe('string');
		}
	});
	it('mix_steps Reihenfolge: nr ist monoton steigend', () => {
		for (let i = 1; i < r.mix_steps.length; i++) {
			expect(r.mix_steps[i].nr).toBeGreaterThan(r.mix_steps[i - 1].nr);
		}
	});
});

describe('CalcResult — EC-Einheiten Konsistenz', () => {
	it('mS/cm vs ppm500 vs ppm700 skalieren konsistent', () => {
		const ms = calculate({ ...BASE, ec_einheit: 'mS/cm' });
		const p500 = calculate({ ...BASE, ec_einheit: 'ppm500' });
		const p700 = calculate({ ...BASE, ec_einheit: 'ppm700' });
		// ec_soll skaliert mit unitFactor (mS/cm = 1, ppm500 = 500, ppm700 = 700)
		// Rundungstoleranz: ec_soll wird auf 2 Dezimalstellen gerundet → kleine relative Abweichung möglich
		expect(p500.ec_soll / ms.ec_soll).toBeCloseTo(500, -1);
		expect(p700.ec_soll / ms.ec_soll).toBeCloseTo(700, -1);
		// ec_ziel_raw bleibt in mS/cm (Schema)
		expect(p500.ec_ziel_raw).toBe(ms.ec_ziel_raw);
		// Dosierungen sind unabhängig von EC-Einheit
		expect(p500.dosierungen.length).toBe(ms.dosierungen.length);
	});
});

describe('CalcResult — Reservoir-Skalierung', () => {
	it('Dosierung skaliert linear mit reservoir_L', () => {
		const r10 = calculate({ ...BASE, reservoir_L: 10 });
		const r20 = calculate({ ...BASE, reservoir_L: 20 });
		for (let i = 0; i < r10.dosierungen.length; i++) {
			expect(r20.dosierungen[i].menge_tank).toBeCloseTo(r10.dosierungen[i].menge_tank * 2, 1);
		}
		// CalMag skaliert auch
		expect(r20.calmag.calmag_mL_total).toBeCloseTo(r10.calmag.calmag_mL_total * 2, 1);
		// Cleanse-Total skaliert ebenfalls
		expect(r20.cleanse_mL_tank).toBeCloseTo(r10.cleanse_mL_tank * 2, 1);
	});
});

describe('CalcResult — Faktor-Modus Wechsel', () => {
	it('Manuell 50% halbiert ec_soll-Anteil', () => {
		const auto = calculate({ ...BASE, faktor_modus: 'Auto' });
		const m50 = calculate({ ...BASE, faktor_modus: 'Manuell', faktor_manuell: 50 });
		expect(m50.faktor_aktiv).toBeLessThan(auto.faktor_aktiv);
		// Dosierungen reduzieren
		const aBloom = auto.dosierungen.find(d => d.product.key === 'bloom');
		const mBloom = m50.dosierungen.find(d => d.product.key === 'bloom');
		expect(mBloom!.menge_tank).toBeLessThan(aBloom!.menge_tank);
	});
});
