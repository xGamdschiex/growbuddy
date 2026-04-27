/**
 * Likes — Toggle + Count für Public-Check-ins (Phase 2 Beta).
 */

import { supabase } from '$lib/supabase';

export async function fetchLikeCounts(checkinIds: string[]): Promise<Record<string, number>> {
	if (checkinIds.length === 0) return {};
	const { data, error } = await supabase
		.from('checkin_likes')
		.select('checkin_id')
		.in('checkin_id', checkinIds);
	if (error) return {};
	const counts: Record<string, number> = {};
	for (const id of checkinIds) counts[id] = 0;
	for (const row of (data as { checkin_id: string }[]) ?? []) {
		counts[row.checkin_id] = (counts[row.checkin_id] ?? 0) + 1;
	}
	return counts;
}

export async function fetchMyLikes(userId: string, checkinIds: string[]): Promise<Set<string>> {
	if (!userId || checkinIds.length === 0) return new Set();
	const { data, error } = await supabase
		.from('checkin_likes')
		.select('checkin_id')
		.eq('user_id', userId)
		.in('checkin_id', checkinIds);
	if (error) return new Set();
	return new Set(((data as { checkin_id: string }[]) ?? []).map(r => r.checkin_id));
}

export async function toggleLike(userId: string, checkinId: string, currentlyLiked: boolean): Promise<{ liked: boolean; error: string | null }> {
	if (!userId) return { liked: currentlyLiked, error: 'Nicht eingeloggt' };
	if (currentlyLiked) {
		const { error } = await supabase
			.from('checkin_likes')
			.delete()
			.eq('user_id', userId)
			.eq('checkin_id', checkinId);
		if (error) return { liked: true, error: error.message };
		return { liked: false, error: null };
	} else {
		const { error } = await supabase
			.from('checkin_likes')
			.insert({ user_id: userId, checkin_id: checkinId });
		if (error) return { liked: false, error: error.message };
		return { liked: true, error: null };
	}
}
