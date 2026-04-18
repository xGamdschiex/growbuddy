/**
 * Gemini Vision API — Plant Doctor Diagnose
 * Nutzt Gemini 2.0 Flash für Pflanzendiagnose aus Fotos.
 * Optional: Kontext aus letztem Check-in + Grow-Info wird automatisch mitgesendet.
 */

import type { CheckIn, Grow } from '$lib/stores/grow';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Fallback-Kaskade: 2.5-flash (höhere Free-Quota) → 2.0-flash als Notfall
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const buildUrl = (model: string) =>
	`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

export interface Diagnosis {
	status: 'healthy' | 'issue' | 'critical';
	summary: string;
	problems: DiagnosisProblem[];
	care_tips: string[];
}

export interface DiagnosisProblem {
	name: string;
	confidence: 'high' | 'medium' | 'low';
	description: string;
	cause: string;
	solution: string[];
}

export interface DiagnosisContext {
	grow?: Grow;
	checkin?: CheckIn;
	/** Tage seit Grow-Start */
	daysSinceStart?: number;
}

const SYSTEM_PROMPT = `Du bist ein Cannabis-Pflanzenexperte und Pflanzendoktor. Analysiere das Foto und gib eine präzise Diagnose.

WICHTIG:
- KEIN Neem-Öl empfehlen (verboten in dieser App)
- Nur biologische/organische Lösungen
- Nützlinge bevorzugen (Neoseiulus californicus, Amblyseius swirskii, Hypoaspis miles etc.)
- Kaliseife NUR in Veg, NICHT in Blüte
- Spinosad und Bt sind OK
- Beauveria bassiana ist OK
- Wenn Grow-Kontext mitgeliefert wurde, nutze ihn für genauere Empfehlungen (Phase, Messwerte, Medium beachten)

Antworte NUR mit validem JSON in diesem Format:
{
  "status": "healthy" | "issue" | "critical",
  "summary": "Kurze Zusammenfassung in 1-2 Sätzen",
  "problems": [
    {
      "name": "Name des Problems",
      "confidence": "high" | "medium" | "low",
      "description": "Was du siehst",
      "cause": "Wahrscheinliche Ursache",
      "solution": ["Schritt 1", "Schritt 2"]
    }
  ],
  "care_tips": ["Allgemeine Pflegetipps basierend auf dem Zustand"]
}

Wenn die Pflanze gesund aussieht, setze status auf "healthy" und problems auf [].
Wenn es kein Cannabis/keine Pflanze ist, antworte trotzdem mit einer allgemeinen Diagnose.`;

function buildContextPrompt(ctx: DiagnosisContext): string {
	const lines: string[] = [];
	if (ctx.grow) {
		lines.push('=== GROW-KONTEXT ===');
		lines.push(`Strain: ${ctx.grow.strain} (${ctx.grow.strain_type === 'auto' ? 'Autoflower' : 'Photoperiod'})`);
		lines.push(`Medium: ${ctx.grow.medium}`);
		if (ctx.grow.space) lines.push(`Space: ${ctx.grow.space}`);
		if (ctx.grow.light_info) lines.push(`Licht: ${ctx.grow.light_info}`);
		if (ctx.grow.feedline_id) lines.push(`Düngerlinie: ${ctx.grow.feedline_id}`);
		if (ctx.grow.plant_count) lines.push(`Pflanzen: ${ctx.grow.plant_count}`);
		if (ctx.daysSinceStart !== undefined) lines.push(`Tage seit Start: ${ctx.daysSinceStart}`);
	}
	if (ctx.checkin) {
		lines.push('=== LETZTER CHECK-IN ===');
		lines.push(`Datum: ${new Date(ctx.checkin.created_at).toLocaleDateString('de-DE')}`);
		lines.push(`Phase: ${ctx.checkin.phase}, Woche ${ctx.checkin.week}, Tag ${ctx.checkin.day}`);
		if (ctx.checkin.temp !== null) lines.push(`Temp: ${ctx.checkin.temp}°C`);
		if (ctx.checkin.rh !== null) lines.push(`Luftfeuchte: ${ctx.checkin.rh}%`);
		if (ctx.checkin.vpd !== null) lines.push(`VPD: ${ctx.checkin.vpd.toFixed(2)} kPa`);
		if (ctx.checkin.ec_measured !== null) lines.push(`EC: ${ctx.checkin.ec_measured}`);
		if (ctx.checkin.ph_measured !== null) lines.push(`pH: ${ctx.checkin.ph_measured}`);
		if (ctx.checkin.watered) lines.push('Kürzlich gegossen: ja');
		if (ctx.checkin.nutrients_given) lines.push('Kürzlich gedüngt: ja');
		if (ctx.checkin.training) lines.push(`Training: ${ctx.checkin.training}`);
		if (ctx.checkin.notes) lines.push(`Notizen: ${ctx.checkin.notes}`);
	}
	return lines.length > 0 ? '\n\n' + lines.join('\n') : '';
}

/**
 * Analysiert ein Pflanzenfoto mit Gemini Vision.
 * @param imageBase64 Base64-kodiertes Bild (data:image/jpeg;base64,...)
 * @param context Optional: Grow + letzter Check-in für präzisere Diagnose
 * @param userNote Optional: Freitext vom User (Frage oder Beschreibung)
 */
export async function diagnosePlant(
	imageBase64: string,
	context?: DiagnosisContext,
	userNote?: string,
	retries: number = 2
): Promise<Diagnosis> {
	if (!API_KEY) {
		throw new Error('Gemini API Key nicht konfiguriert');
	}

	const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
	const mimeType = imageBase64.includes('image/png') ? 'image/png' : 'image/jpeg';
	const userNoteSection = userNote?.trim() ? `\n\n=== FRAGE DES GROWERS ===\n${userNote.trim()}` : '';
	const fullPrompt = SYSTEM_PROMPT + (context ? buildContextPrompt(context) : '') + userNoteSection;

	const body = JSON.stringify({
		contents: [{
			parts: [
				{ text: fullPrompt },
				{ inline_data: { mime_type: mimeType, data: base64Data } }
			]
		}],
		generationConfig: {
			temperature: 0.3,
			maxOutputTokens: 2048,
			responseMimeType: 'application/json',
		},
	});

	let lastError: Error | null = null;
	let quotaHit = false;

	// Jedes Model nacheinander probieren; bei 429 direkt nächstes Model
	for (const model of MODELS) {
		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				const response = await fetch(buildUrl(model), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body,
				});

				if (response.status === 429) {
					quotaHit = true;
					lastError = new Error(`Quota erreicht (${model})`);
					break; // nächstes Model
				}

				if (!response.ok) {
					const err = await response.text();
					throw new Error(`Gemini API Fehler: ${response.status} — ${err.slice(0, 200)}`);
				}

				const data = await response.json();
				const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

				if (!text) throw new Error('Keine Antwort von Gemini erhalten');

				return JSON.parse(text) as Diagnosis;
			} catch (e: any) {
				lastError = e instanceof Error ? e : new Error(String(e));
				if (attempt < retries) {
					await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
				}
			}
		}
	}

	if (quotaHit) {
		throw new Error('Gemini Tages-Limit erreicht. Bitte morgen erneut versuchen oder Billing in Google AI Studio aktivieren.');
	}
	throw lastError ?? new Error('Diagnose fehlgeschlagen');
}
