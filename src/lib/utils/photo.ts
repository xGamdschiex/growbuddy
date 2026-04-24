/**
 * Photo-Compression Utility — Async, UI-freundlich.
 * Nutzt OffscreenCanvas + createImageBitmap wo verfügbar (Android Chrome/WebView),
 * sonst Fallback auf klassisches Canvas. Yields zwischen Bildern zum Event-Loop,
 * damit das UI auf Mid-Range-Geräten nicht einfriert.
 */

export const MAX_PHOTOS = 5;
export const PHOTO_MAX_SIZE = 1024;
export const PHOTO_QUALITY = 0.75;

function nextTick(): Promise<void> {
	return new Promise(r => setTimeout(r, 0));
}

async function compressViaOffscreen(file: File, maxSize: number, quality: number): Promise<string> {
	const bitmap = await createImageBitmap(file);
	let w = bitmap.width, h = bitmap.height;
	if (w > maxSize || h > maxSize) {
		if (w > h) { h = (h / w) * maxSize; w = maxSize; }
		else { w = (w / h) * maxSize; h = maxSize; }
	}
	const canvas = new OffscreenCanvas(w, h);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('No 2d context');
	ctx.drawImage(bitmap, 0, 0, w, h);
	bitmap.close?.();
	const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
	return await blobToDataUrl(blob);
}

function compressViaDomCanvas(file: File, maxSize: number, quality: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error('FileReader failed'));
		reader.onload = () => {
			const img = new Image();
			img.onerror = () => reject(new Error('Image load failed'));
			img.onload = () => {
				const canvas = document.createElement('canvas');
				let w = img.width, h = img.height;
				if (w > maxSize || h > maxSize) {
					if (w > h) { h = (h / w) * maxSize; w = maxSize; }
					else { w = (w / h) * maxSize; h = maxSize; }
				}
				canvas.width = w; canvas.height = h;
				canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
				resolve(canvas.toDataURL('image/jpeg', quality));
			};
			img.src = reader.result as string;
		};
		reader.readAsDataURL(file);
	});
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(r.result as string);
		r.onerror = () => reject(new Error('Blob read failed'));
		r.readAsDataURL(blob);
	});
}

export async function compressImage(
	file: File,
	maxSize = PHOTO_MAX_SIZE,
	quality = PHOTO_QUALITY,
): Promise<string> {
	const canOffscreen =
		typeof OffscreenCanvas !== 'undefined' &&
		typeof createImageBitmap === 'function';
	try {
		if (canOffscreen) return await compressViaOffscreen(file, maxSize, quality);
	} catch {
		// Fallback zu DOM-Canvas
	}
	return compressViaDomCanvas(file, maxSize, quality);
}

/**
 * Komprimiert mehrere Bilder sequenziell mit Yield zwischen Bildern.
 * Verhindert UI-Freeze auf Mid-Range-Android bei 3-5 Bildern.
 */
export async function compressBatch(
	files: File[],
	maxSize = PHOTO_MAX_SIZE,
	quality = PHOTO_QUALITY,
): Promise<string[]> {
	const out: string[] = [];
	for (const f of files) {
		out.push(await compressImage(f, maxSize, quality));
		await nextTick();
	}
	return out;
}
