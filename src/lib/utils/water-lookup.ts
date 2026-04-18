/**
 * Gemini Water Lookup — Wasserwerte per Stadtname ermitteln
 * User gibt Stadt/PLZ ein → Gemini sucht Wasserwerte beim lokalen Versorger.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

export interface WaterValues {
	ca: number;      // mg/L
	mg: number;      // mg/L
	ec: number;      // mS/cm
	ph: number;
	hardness: number; // °dH
	source: string;   // z.B. "Stadtwerke München 2024"
	note: string;     // Zusatzinfo
}

const PROMPT = `Du bist Experte für Trinkwasseranalyse. Der User gibt einen Standort an (Stadt, PLZ, Region).

Finde die aktuellen Trinkwasserwerte des zuständigen Wasserversorgers.

WICHTIG:
- Nutze offizielle Daten (Wasserversorger-Webseiten, Jahresberichte)
- Calcium (Ca) und Magnesium (Mg) in mg/L
- EC (elektrische Leitfähigkeit) in mS/cm — falls nicht direkt verfügbar, schätze aus Gesamthärte
- pH-Wert
- Gesamthärte in °dH
- Wenn du dir unsicher bist, schätze konservativ und markiere als "geschätzt"

Antworte NUR mit validem JSON:
{
  "ca": <number>,
  "mg": <number>,
  "ec": <number>,
  "ph": <number>,
  "hardness": <number>,
  "source": "Wasserversorger + Jahr",
  "note": "Zusatzinfo oder 'geschätzt' wenn unsicher"
}`;

export async function lookupWaterValues(location: string): Promise<WaterValues> {
	if (!API_KEY) {
		throw new Error('Gemini API Key nicht konfiguriert');
	}

	const response = await fetch(API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			contents: [{
				parts: [
					{ text: PROMPT },
					{ text: `Standort: ${location}` },
				]
			}],
			generationConfig: {
				temperature: 0.2,
				maxOutputTokens: 512,
				responseMimeType: 'application/json',
			},
		}),
	});

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`Gemini API Fehler: ${response.status}`);
	}

	const data = await response.json();
	const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

	if (!text) {
		throw new Error('Keine Antwort von Gemini');
	}

	const result = JSON.parse(text) as WaterValues;

	// Validierung: Werte müssen in realistischem Bereich liegen
	if (result.ca < 0 || result.ca > 500) throw new Error('Ca-Wert unrealistisch');
	if (result.mg < 0 || result.mg > 200) throw new Error('Mg-Wert unrealistisch');
	if (result.ec < 0 || result.ec > 5) throw new Error('EC-Wert unrealistisch');
	if (result.ph < 4 || result.ph > 10) throw new Error('pH-Wert unrealistisch');

	return result;
}
