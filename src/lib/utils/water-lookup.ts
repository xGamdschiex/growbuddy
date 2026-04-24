/**
 * Gemini Water Lookup — Wasserwerte per Stadtname ermitteln.
 * Model-Kaskade 2.5-flash → 2.0-flash mit Retry. 30-Tage localStorage-Cache.
 */

import { safeSetItem } from '$lib/utils/storage-safe';
import { logger } from '$lib/utils/logger';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const CACHE_KEY = 'growbuddy_water_lookup_cache';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage — Wasserwerte ändern sich nur bei Labor-Reports

const buildUrl = (model: string) =>
	`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

export interface WaterValues {
	ca: number;
	mg: number;
	ec: number;
	ph: number;
	hardness: number;
	source: string;
	note: string;
}

interface CacheEntry {
	values: WaterValues;
	timestamp: number;
}
type Cache = Record<string, CacheEntry>;

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

function loadCache(): Cache {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function saveCache(cache: Cache) {
	safeSetItem(CACHE_KEY, JSON.stringify(cache));
}

function cacheGet(location: string): WaterValues | null {
	const cache = loadCache();
	const entry = cache[location.toLowerCase()];
	if (!entry) return null;
	if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
	return entry.values;
}

function cacheSet(location: string, values: WaterValues) {
	const cache = loadCache();
	cache[location.toLowerCase()] = { values, timestamp: Date.now() };
	saveCache(cache);
}

function validate(v: WaterValues): void {
	if (v.ca < 0 || v.ca > 500) throw new Error('Ca-Wert unrealistisch');
	if (v.mg < 0 || v.mg > 200) throw new Error('Mg-Wert unrealistisch');
	if (v.ec < 0 || v.ec > 5) throw new Error('EC-Wert unrealistisch');
	if (v.ph < 4 || v.ph > 10) throw new Error('pH-Wert unrealistisch');
}

export async function lookupWaterValues(location: string, retries = 2): Promise<WaterValues> {
	if (!API_KEY) throw new Error('Gemini API Key nicht konfiguriert');

	const cached = cacheGet(location);
	if (cached) return cached;

	const body = JSON.stringify({
		contents: [
			{
				parts: [
					{ text: PROMPT },
					{ text: `Standort: ${location}` },
				],
			},
		],
		generationConfig: {
			temperature: 0.2,
			maxOutputTokens: 512,
			responseMimeType: 'application/json',
		},
	});

	let lastError: Error | null = null;
	let quotaHit = false;

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
					break; // nächstes Model direkt
				}

				if (!response.ok) {
					throw new Error(`Gemini Fehler: ${response.status}`);
				}

				const data = await response.json();
				const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
				if (!text) throw new Error('Keine Antwort von Gemini');

				const result = JSON.parse(text) as WaterValues;
				validate(result);

				cacheSet(location, result);
				return result;
			} catch (e: any) {
				lastError = e instanceof Error ? e : new Error(String(e));
				logger.warn('Water-Lookup fetch fehlgeschlagen', { model, attempt, err: lastError.message });
				if (attempt < retries) {
					await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
				}
			}
		}
	}

	if (quotaHit) {
		throw new Error('Gemini Tages-Limit erreicht. Bitte später erneut oder Werte manuell eingeben.');
	}
	throw lastError ?? new Error('Standortabfrage fehlgeschlagen');
}

/** Cache manuell leeren (z.B. in Settings-Page) */
export function clearWaterLookupCache(): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(CACHE_KEY);
	}
}
