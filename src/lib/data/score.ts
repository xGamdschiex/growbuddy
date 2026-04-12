/**
 * Grow Score — 0-100 Bewertung basierend auf echten Metriken.
 *
 * Kategorien (Gewichtung):
 * - Konsistenz (30%): Check-in-Frequenz relativ zur Grow-Dauer
 * - Umwelt (25%): Wie oft VPD/Temp/RH im optimalen Bereich
 * - Dokumentation (20%): Fotos, vollständige Daten, Notizen
 * - Pflege (15%): Regelmäßig gegossen/gedüngt
 * - Training (10%): Trainingstechniken angewendet
 */

import type { Grow, CheckIn } from '$lib/stores/grow';
import { VPD_TARGETS } from '$lib/data/science';

export interface ScoreBreakdown {
	total: number;
	consistency: number;  // 0-100
	environment: number;  // 0-100
	documentation: number; // 0-100
	care: number;         // 0-100
	training: number;     // 0-100
}

export function calculateGrowScore(grow: Grow, checkins: CheckIn[]): ScoreBreakdown {
	const days = Math.max(1, Math.floor(
		((grow.harvested_at ? new Date(grow.harvested_at).getTime() : Date.now()) - new Date(grow.started_at).getTime()) / 86400000
	));

	// ─── Konsistenz (30%) ─────────────────────────────────────
	// Ideal: mindestens 1 Check-in alle 2 Tage
	const expectedCheckins = Math.max(1, Math.floor(days / 2));
	const consistencyRatio = Math.min(1, checkins.length / expectedCheckins);
	const consistency = Math.round(consistencyRatio * 100);

	// ─── Umwelt (25%) ─────────────────────────────────────────
	// VPD im optimalen Bereich (0.8-1.2 für Veg, 1.0-1.5 für Bloom)
	const checksWithVpd = checkins.filter(c => c.vpd !== null);
	let envScore = 0;
	if (checksWithVpd.length > 0) {
		const optimalCount = checksWithVpd.filter(c => {
			const vpd = c.vpd!;
			const phase = c.phase.toLowerCase();
			if (phase === 'bloom' || phase === 'flush') {
				return vpd >= 0.9 && vpd <= 1.6;
			}
			return vpd >= 0.6 && vpd <= 1.3; // Veg/Seedling/allgemein
		}).length;
		envScore = Math.round((optimalCount / checksWithVpd.length) * 100);
	} else if (checkins.length > 0) {
		// Keine VPD-Daten = 40% Umwelt-Score (Messwerte fehlen)
		envScore = 40;
	}
	const environment = envScore;

	// ─── Dokumentation (20%) ────��─────────────────────────────
	const withPhoto = checkins.filter(c => c.photo_data).length;
	const withFullData = checkins.filter(c => c.temp && c.rh && c.ec_measured && c.ph_measured).length;
	const withNotes = checkins.filter(c => c.notes.trim().length > 0).length;

	let docScore = 0;
	if (checkins.length > 0) {
		const photoRatio = withPhoto / checkins.length;
		const dataRatio = withFullData / checkins.length;
		const notesRatio = withNotes / checkins.length;
		docScore = Math.round((photoRatio * 40 + dataRatio * 40 + notesRatio * 20) * 100) / 100;
		docScore = Math.round(docScore * 100);
	}
	const documentation = Math.min(100, docScore);

	// ─── Pflege (15%) ──��──────────────────────────────────────
	const wateredCount = checkins.filter(c => c.watered).length;
	const nutrientsCount = checkins.filter(c => c.nutrients_given).length;

	let careScore = 0;
	if (checkins.length > 0) {
		// Mindestens alle 3 Tage gießen, alle 4 Tage düngen
		const expectedWatering = Math.max(1, Math.floor(days / 3));
		const expectedFeeding = Math.max(1, Math.floor(days / 4));
		const waterRatio = Math.min(1, wateredCount / expectedWatering);
		const feedRatio = Math.min(1, nutrientsCount / expectedFeeding);
		careScore = Math.round((waterRatio * 60 + feedRatio * 40) * 100) / 100;
		careScore = Math.round(careScore * 100);
	}
	const care = Math.min(100, careScore);

	// ─��─ Training (10%) ──────────────────��────────────────────
	const trainingCheckins = checkins.filter(c => c.training).length;
	const uniqueTrainings = new Set(checkins.filter(c => c.training).map(c => c.training)).size;
	// Bonus für Vielfalt, aber mindestens 1 Training ergibt 50%
	let trainingScore = 0;
	if (trainingCheckins > 0) {
		trainingScore = Math.min(100, 50 + uniqueTrainings * 15);
	}
	const training = trainingScore;

	// ─── Gesamt ──────────────���────────────────────────────────
	const total = Math.round(
		consistency * 0.30 +
		environment * 0.25 +
		documentation * 0.20 +
		care * 0.15 +
		training * 0.10
	);

	return {
		total: Math.min(100, total),
		consistency,
		environment,
		documentation,
		care,
		training,
	};
}
