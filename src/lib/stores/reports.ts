/**
 * Report-System (Phase 2 Beta) — Community-Moderation.
 */

import { supabase } from '$lib/supabase';

export const REPORT_REASONS = [
	{ id: 'spam', label: 'Spam' },
	{ id: 'inappropriate', label: 'Unangemessener Inhalt' },
	{ id: 'underage', label: 'Minderjährig / Verbotenes' },
	{ id: 'fake', label: 'Fake-Account / Fake-Pflanze' },
	{ id: 'other', label: 'Sonstiges' },
] as const;

export type ReportReason = typeof REPORT_REASONS[number]['id'];

export async function submitReport(
	reporterId: string,
	checkinId: string,
	reason: ReportReason,
	details?: string
): Promise<{ error: string | null }> {
	if (!reporterId) return { error: 'Nicht eingeloggt' };
	const { error } = await supabase
		.from('reports')
		.insert({
			reporter_id: reporterId,
			checkin_id: checkinId,
			reason,
			details: details?.slice(0, 500) ?? null,
		});
	if (error) return { error: error.message };
	return { error: null };
}
