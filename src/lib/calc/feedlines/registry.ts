/**
 * FeedLine Registry — Zentrale Registrierung aller Düngerlinien
 */

import type { FeedLine } from './types';
import { athenaPro } from './athena-pro';
import { biobizz } from './biobizz';
import { ghHybrids, ghShortFlowering, ghGrow } from './greenhouse-feeding';
import { atamiBcuzz } from './atami-bcuzz';
import { cannaTerra, cannaCoco } from './canna';
import { advancedSensi } from './advanced-nutrients';

// ─── REGISTRY ────────────────────────────────────────────────────────────

const FEEDLINES: Map<string, FeedLine> = new Map();

function register(line: FeedLine): void {
  FEEDLINES.set(line.id, line);
}

// Alle Lines registrieren
register(athenaPro);
register(biobizz);
register(ghHybrids);
register(ghShortFlowering);
register(ghGrow);
register(atamiBcuzz);
register(cannaTerra);
register(cannaCoco);
register(advancedSensi);

// ─── PUBLIC API ──────────────────────────────────────────────────────────

/** Hole eine FeedLine per ID */
export function getFeedLine(id: string): FeedLine | undefined {
  return FEEDLINES.get(id);
}

/** Alle registrierten FeedLines */
export function getAllFeedLines(): FeedLine[] {
  return Array.from(FEEDLINES.values());
}

/** Alle FeedLine-IDs */
export function getFeedLineIds(): string[] {
  return Array.from(FEEDLINES.keys());
}

/** Default FeedLine ID */
export const DEFAULT_FEEDLINE = 'athena-pro';

/** Re-exports */
export { athenaPro } from './athena-pro';
export { biobizz } from './biobizz';
export { ghHybrids, ghShortFlowering, ghGrow } from './greenhouse-feeding';
export { atamiBcuzz } from './atami-bcuzz';
export { cannaTerra, cannaCoco } from './canna';
export { advancedSensi } from './advanced-nutrients';
export type { FeedLine, FeedProduct, FeedSchemaRow, PhaseConfig, GenericCalcInput, DosierungResult } from './types';
export { getSchemaForWeek, getWochenForPhase, calcProductDosierung, calcGrowDay, calcTotalDays } from './types';
