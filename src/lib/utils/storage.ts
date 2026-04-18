/**
 * Supabase Storage Helper — Upload/Download für Check-in-Fotos.
 * Bucket: `checkin-photos` (public: false, RLS per user_id).
 */

import { supabase } from '$lib/supabase';

const BUCKET = 'checkin-photos';

/**
 * Konvertiert base64-Dataurl in Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
	const [header, b64] = dataUrl.split(',');
	const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
	const binary = atob(b64!);
	const len = binary.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
	return new Blob([bytes], { type: mime });
}

/**
 * Lädt ein Check-in-Foto hoch. Pfad: `{userId}/{checkinId}.jpg`
 * @returns Signed URL (7 Tage gültig) oder null bei Fehler
 */
export async function uploadCheckinPhoto(userId: string, checkinId: string, dataUrl: string): Promise<string | null> {
	try {
		const blob = dataUrlToBlob(dataUrl);
		const path = `${userId}/${checkinId}.jpg`;
		const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
			contentType: blob.type,
			upsert: true,
		});
		if (error) throw error;

		const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
		if (signErr) throw signErr;
		return data.signedUrl;
	} catch (e) {
		console.warn('uploadCheckinPhoto failed:', e);
		return null;
	}
}

/**
 * Lädt mehrere Check-in-Fotos parallel hoch. Pfad: `{userId}/{checkinId}-{idx}.jpg`
 * @returns Array aus Signed URLs (null-Einträge bei Fehler)
 */
export async function uploadCheckinPhotos(userId: string, checkinId: string, dataUrls: string[]): Promise<string[]> {
	const uploads = await Promise.all(dataUrls.map(async (url, idx) => {
		try {
			const blob = dataUrlToBlob(url);
			const path = `${userId}/${checkinId}-${idx}.jpg`;
			const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
				contentType: blob.type,
				upsert: true,
			});
			if (error) throw error;
			const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
			if (signErr) throw signErr;
			return data.signedUrl;
		} catch (e) {
			console.warn('uploadCheckinPhotos failed at idx', idx, e);
			return null;
		}
	}));
	return uploads.filter((u): u is string => !!u);
}

/**
 * Holt Signed URL für ein bestehendes Foto.
 */
export async function getCheckinPhotoUrl(userId: string, checkinId: string): Promise<string | null> {
	const path = `${userId}/${checkinId}.jpg`;
	const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
	if (error) return null;
	return data.signedUrl;
}

/**
 * Löscht ein Foto aus Storage.
 */
export async function deleteCheckinPhoto(userId: string, checkinId: string): Promise<void> {
	const path = `${userId}/${checkinId}.jpg`;
	await supabase.storage.from(BUCKET).remove([path]);
}
