/**
 * Default-Mix-Strategien für Düngerlinien.
 *
 * Bereitstellung wiederverwendbarer Bausteine, die jede Line in ihrem
 * `module.buildMixSteps()`-Hook nutzen kann.
 *
 * Linien ohne eigenes Modul bekommen `defaultMixSteps()` als Fallback.
 */

import type { MixContext, MixStep, DosierungResult } from './types';

/**
 * Wasser-Schritt (immer Step 1).
 */
export function waterStep(ctx: MixContext, nr: number): MixStep {
	const hat_ro = (ctx.input as any).hat_ro !== false;
	return {
		nr,
		label: 'Wasser befuellen',
		detail: hat_ro
			? `${ctx.ro_L} L RO + ${ctx.lw_L} L Leitungswasser`
			: `${ctx.input.reservoir_L} L Leitungswasser (kein RO)`,
		menge: `${ctx.input.reservoir_L} L`,
	};
}

/**
 * CalMag + MonoMg-Schritte (in der Reihenfolge MonoMg → CalMag).
 */
export function calmagSteps(ctx: MixContext, startNr: number): { steps: MixStep[]; nextNr: number } {
	const steps: MixStep[] = [];
	let nr = startNr;
	if (ctx.calmag.mono_mg_mL_total > 0) {
		steps.push({
			nr: nr++,
			label: 'Mono Mg',
			detail: `${ctx.calmag.mono_mg_mLpL} mL/L`,
			menge: `${ctx.calmag.mono_mg_mL_total} mL`,
		});
	}
	if (ctx.calmag.calmag_mL_total > 0) {
		steps.push({
			nr: nr++,
			label: ctx.calmag_name,
			detail: `${ctx.calmag.calmag_mLpL} mL/L`,
			menge: `${ctx.calmag.calmag_mL_total} mL`,
		});
	}
	return { steps, nextNr: nr };
}

/**
 * Produkt-Dosierungen als Mix-Steps.
 */
export function productSteps(dosierungen: DosierungResult[], startNr: number): { steps: MixStep[]; nextNr: number } {
	const steps: MixStep[] = [];
	let nr = startNr;
	for (const d of dosierungen) {
		const schemaLabel = d.product.pro === '10L'
			? `${d.menge_schema} ${d.product.einheit}/10L`
			: `${d.menge_schema} ${d.product.einheit}/L`;
		steps.push({
			nr: nr++,
			label: d.product.einheit === 'g'
				? `${d.product.name} einwiegen`
				: `${d.product.name} abmessen`,
			detail: `Schema: ${schemaLabel}`,
			menge: d.display,
		});
	}
	return { steps, nextNr: nr };
}

/**
 * Cleanse-Schritt (Athena-Style, ramped).
 */
export function cleanseStep(ctx: MixContext, nr: number): MixStep | null {
	if (ctx.cleanse_mL_tank <= 0) return null;
	return {
		nr,
		label: 'Cleanse',
		detail: `${ctx.cleanse_mL_tank} mL auf Tank`,
		menge: `${ctx.cleanse_mL_tank} mL`,
	};
}

/**
 * pH + EC Kontroll-Schritte (am Ende).
 */
export function controlSteps(ctx: MixContext, startNr: number): MixStep[] {
	let nr = startNr;
	return [
		{ nr: nr++, label: 'pH einstellen', detail: `Zielbereich: ${ctx.ph_ziel}`, menge: ctx.ph_ziel },
		{ nr: nr++, label: 'EC kontrollieren', detail: `EC-Soll: ${ctx.ec_soll}`, menge: `${ctx.ec_soll}` },
	];
}

/**
 * Default-Reihenfolge: Wasser → Produkte → CalMag → pH → EC.
 * Wird von Linien ohne eigenes `module.buildMixSteps` verwendet.
 *
 * Konvention: "Produkte zuerst, CalMag zum Schluss" — das ist die häufigste
 * Empfehlung bei BioBizz, Canna, GH Feeding (Hydroponik / Erde).
 */
export function defaultMixSteps(ctx: MixContext): MixStep[] {
	const steps: MixStep[] = [];
	let nr = 1;

	steps.push(waterStep(ctx, nr++));

	const products = productSteps(ctx.dosierungen, nr);
	steps.push(...products.steps);
	nr = products.nextNr;

	const cm = calmagSteps(ctx, nr);
	steps.push(...cm.steps);
	nr = cm.nextNr;

	steps.push(...controlSteps(ctx, nr));
	return steps;
}
