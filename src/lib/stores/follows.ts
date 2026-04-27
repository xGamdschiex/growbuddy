/**
 * Follow-System (Phase 2 Beta).
 */

import { supabase } from '$lib/supabase';

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
	if (!followerId || !followeeId || followerId === followeeId) return false;
	const { count } = await supabase
		.from('follows')
		.select('follower_id', { count: 'exact', head: true })
		.eq('follower_id', followerId)
		.eq('followee_id', followeeId);
	return (count ?? 0) > 0;
}

export async function fetchFollowerCount(userId: string): Promise<number> {
	const { count } = await supabase
		.from('follows')
		.select('follower_id', { count: 'exact', head: true })
		.eq('followee_id', userId);
	return count ?? 0;
}

export async function fetchFollowingCount(userId: string): Promise<number> {
	const { count } = await supabase
		.from('follows')
		.select('followee_id', { count: 'exact', head: true })
		.eq('follower_id', userId);
	return count ?? 0;
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
	if (!userId) return [];
	const { data, error } = await supabase
		.from('follows')
		.select('followee_id')
		.eq('follower_id', userId);
	if (error) return [];
	return ((data as { followee_id: string }[]) ?? []).map(r => r.followee_id);
}

export async function toggleFollow(
	followerId: string,
	followeeId: string,
	currentlyFollowing: boolean
): Promise<{ following: boolean; error: string | null }> {
	if (!followerId) return { following: currentlyFollowing, error: 'Nicht eingeloggt' };
	if (followerId === followeeId) return { following: false, error: 'Kann sich nicht selbst folgen' };
	if (currentlyFollowing) {
		const { error } = await supabase
			.from('follows')
			.delete()
			.eq('follower_id', followerId)
			.eq('followee_id', followeeId);
		if (error) return { following: true, error: error.message };
		return { following: false, error: null };
	} else {
		const { error } = await supabase
			.from('follows')
			.insert({ follower_id: followerId, followee_id: followeeId });
		if (error) return { following: false, error: error.message };
		return { following: true, error: null };
	}
}
