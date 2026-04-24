/**
 * Zentrale Constants — Magic Numbers an einem Ort.
 * Single-Source-of-Truth für Photo-, EC-, Cache-, Form-Limits.
 */

// ─── PHOTOS ─────────────────────────────────────────────────────────────
export const MAX_PHOTOS_PER_CHECKIN = 5;
export const PHOTO_MAX_DIMENSION = 1024;
export const PHOTO_QUALITY = 0.75;
export const PHOTO_MAX_COMPACT = 800;

// ─── EC / pH ────────────────────────────────────────────────────────────
export const EC_STEP_MSCM = 0.1;
export const EC_STEP_PPM = 10;
export const EC_PLACEHOLDER_MSCM = '1.5';
export const EC_PLACEHOLDER_PPM500 = '750';
export const EC_PLACEHOLDER_PPM700 = '1050';

// ─── CACHE / TTL ────────────────────────────────────────────────────────
export const WATER_LOOKUP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage

// ─── CHECK-IN ───────────────────────────────────────────────────────────
export const MAX_DAILY_CHECKINS_FOR_XP = 3;
export const DAY_MS = 86400000;

// ─── GROW ───────────────────────────────────────────────────────────────
export const FREE_TIER_MAX_GROWS = 1;
export const FREE_TIER_MAX_FEEDLINES = 2;

// ─── STORAGE KEYS ───────────────────────────────────────────────────────
export const STORAGE_KEYS = {
	grows: 'growbuddy_grows',
	calc: 'growbuddy_calc',
	xp: 'growbuddy_xp',
	streak: 'growbuddy_streak',
	reminders: 'growbuddy_reminders',
	pro: 'growbuddy_pro',
	onboarding: 'growbuddy_onboarding',
	locale: 'growbuddy_locale',
	sync: 'growbuddy_sync',
	ecUnit: 'growbuddy_ec_unit',
	waterLookup: 'growbuddy_water_cache',
} as const;
