/**
 * Achievements — freigeschaltet durch echte Grow-Aktionen.
 * Jedes Achievement hat eine check()-Funktion die gegen den aktuellen State prüft.
 */

export interface Achievement {
	id: string;
	name: string;
	description: string;
	icon: string;
	xp: number;
	check: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
	total_grows: number;
	total_harvests: number;
	total_checkins: number;
	total_photos: number;
	best_score: number | null;
	unique_strains: number;
	longest_streak: number;
	total_xp: number;
	calc_uses: number;       // Anzahl Tage mit Calc-Nutzung
	tool_uses: number;       // Anzahl Tage mit Tool-Nutzung
}

export const ACHIEVEMENTS: Achievement[] = [
	{
		id: 'first_seed',
		name: 'First Seed',
		description: 'Starte deinen ersten Grow',
		icon: '🌱',
		xp: 25,
		check: (s) => s.total_grows >= 1,
	},
	{
		id: 'first_harvest',
		name: 'Erste Ernte',
		description: 'Ernte deinen ersten Grow',
		icon: '🌾',
		xp: 50,
		check: (s) => s.total_harvests >= 1,
	},
	{
		id: 'streak_7',
		name: 'Woche geschafft',
		description: '7 Tage Check-in Streak',
		icon: '🔥',
		xp: 25,
		check: (s) => s.longest_streak >= 7,
	},
	{
		id: 'streak_30',
		name: 'Monats-Streak',
		description: '30 Tage Check-in Streak',
		icon: '💎',
		xp: 100,
		check: (s) => s.longest_streak >= 30,
	},
	{
		id: 'score_80',
		name: 'Qualitäts-Grower',
		description: 'Erreiche einen Grow Score von 80+',
		icon: '⭐',
		xp: 50,
		check: (s) => (s.best_score ?? 0) >= 80,
	},
	{
		id: 'score_95',
		name: 'Perfektionist',
		description: 'Erreiche einen Grow Score von 95+',
		icon: '🏆',
		xp: 100,
		check: (s) => (s.best_score ?? 0) >= 95,
	},
	{
		id: 'five_strains',
		name: 'Sortenkenner',
		description: 'Baue 5 verschiedene Strains an',
		icon: '🧬',
		xp: 50,
		check: (s) => s.unique_strains >= 5,
	},
	{
		id: 'ten_harvests',
		name: 'Ernte-Veteran',
		description: '10 erfolgreiche Ernten',
		icon: '🎖️',
		xp: 100,
		check: (s) => s.total_harvests >= 10,
	},
	{
		id: 'photographer',
		name: 'Fotograf',
		description: 'Mache 50 Fotos in Check-ins',
		icon: '📸',
		xp: 30,
		check: (s) => s.total_photos >= 50,
	},
	{
		id: 'scientist',
		name: 'Wissenschaftler',
		description: 'Nutze den Düngerrechner an 10 verschiedenen Tagen',
		icon: '🔬',
		xp: 30,
		check: (s) => s.calc_uses >= 10,
	},
	{
		id: 'checkin_100',
		name: 'Tagebuch-Profi',
		description: '100 Check-ins durchgeführt',
		icon: '📋',
		xp: 75,
		check: (s) => s.total_checkins >= 100,
	},
	{
		id: 'multi_grower',
		name: 'Multi-Grower',
		description: 'Starte 5 Grows',
		icon: '🌿',
		xp: 40,
		check: (s) => s.total_grows >= 5,
	},
];
