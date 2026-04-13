/**
 * Gemini Vision API — Plant Doctor Diagnose
 * Nutzt Gemini 2.0 Flash für Pflanzendiagnose aus Fotos.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

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

const SYSTEM_PROMPT = `Du bist ein Cannabis-Pflanzenexperte und Pflanzendoktor. Analysiere das Foto und gib eine präzise Diagnose.

WICHTIG:
- KEIN Neem-Öl empfehlen (verboten in dieser App)
- Nur biologische/organische Lösungen
- Nützlinge bevorzugen (Neoseiulus californicus, Amblyseius swirskii, Hypoaspis miles etc.)
- Kaliseife NUR in Veg, NICHT in Blüte
- Spinosad und Bt sind OK
- Beauveria bassiana ist OK

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

/**
 * Analysiert ein Pflanzenfoto mit Gemini Vision
 * @param imageBase64 Base64-kodiertes Bild (data:image/jpeg;base64,...)
 */
export async function diagnosePlant(imageBase64: string): Promise<Diagnosis> {
	if (!API_KEY) {
		throw new Error('Gemini API Key nicht konfiguriert');
	}

	// Base64-Daten extrahieren (ohne data:image/... prefix)
	const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
	const mimeType = imageBase64.includes('image/png') ? 'image/png' : 'image/jpeg';

	const response = await fetch(API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			contents: [{
				parts: [
					{ text: SYSTEM_PROMPT },
					{
						inline_data: {
							mime_type: mimeType,
							data: base64Data,
						}
					}
				]
			}],
			generationConfig: {
				temperature: 0.3,
				maxOutputTokens: 2048,
				responseMimeType: 'application/json',
			},
		}),
	});

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`Gemini API Fehler: ${response.status} — ${err.slice(0, 200)}`);
	}

	const data = await response.json();
	const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

	if (!text) {
		throw new Error('Keine Antwort von Gemini erhalten');
	}

	try {
		return JSON.parse(text) as Diagnosis;
	} catch {
		throw new Error('Gemini-Antwort konnte nicht verarbeitet werden');
	}
}
