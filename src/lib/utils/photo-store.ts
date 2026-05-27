/**
 * Photo Store — Fotos in IndexedDB statt Base64 im localStorage.
 *
 * localStorage hat ~5-10 MB Gesamt-Limit → Base64-Fotos sprengen es schnell.
 * IndexedDB hat hunderte MB Quota und speichert die Bilder rein lokal.
 * Wir speichern Data-URLs (JPEG-Base64-Strings) unter Referenz-IDs (`lp_…`),
 * der Grow-Store hält nur noch diese IDs im localStorage-JSON.
 *
 * Alle Funktionen sind SSR-sicher (no-op wenn IndexedDB fehlt).
 */

const DB_NAME = 'growbuddy';
const STORE = 'photos';            // Anzeige-/Thumbnail-Data-URLs (klein, wird in den Speicher hydriert)
const ORIGINALS = 'originals';     // Original-Bilder als Blob (groß, NUR lazy fürs Vollbild)
const VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIDB(): boolean {
	return typeof indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
			if (!db.objectStoreNames.contains(ORIGINALS)) db.createObjectStore(ORIGINALS);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return dbPromise;
}

/** Erzeugt eine neue lokale Foto-Referenz-ID. */
export function newPhotoId(): string {
	const rnd = (typeof crypto !== 'undefined' && crypto.randomUUID)
		? crypto.randomUUID()
		: Date.now() + '_' + Math.random().toString(36).slice(2);
	return 'lp_' + rnd;
}

/** Speichert eine Data-URL unter `id`. Wirft bei Fehler (Aufrufer fängt ab). */
export async function putPhoto(id: string, dataUrl: string): Promise<void> {
	if (!hasIDB()) throw new Error('IndexedDB nicht verfügbar');
	const db = await openDB();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(dataUrl, id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

/** Liest eine Data-URL. Gibt null zurück wenn nicht vorhanden / Fehler. */
export async function getPhoto(id: string): Promise<string | null> {
	if (!hasIDB()) return null;
	try {
		const db = await openDB();
		return await new Promise((resolve) => {
			const tx = db.transaction(STORE, 'readonly');
			const req = tx.objectStore(STORE).get(id);
			req.onsuccess = () => resolve((req.result as string) ?? null);
			req.onerror = () => resolve(null);
		});
	} catch {
		return null;
	}
}

/** Löscht mehrere Fotos (Thumbnail + Original, best-effort). */
export async function deletePhotos(ids: string[]): Promise<void> {
	if (!hasIDB() || !ids.length) return;
	try {
		const db = await openDB();
		await new Promise<void>((resolve) => {
			const tx = db.transaction([STORE, ORIGINALS], 'readwrite');
			const os = tx.objectStore(STORE);
			const oo = tx.objectStore(ORIGINALS);
			for (const id of ids) { os.delete(id); oo.delete(id); }
			tx.oncomplete = () => resolve();
			tx.onerror = () => resolve();
			tx.onabort = () => resolve();
		});
	} catch {
		/* ignore */
	}
}

/** Speichert das ORIGINAL-Bild (Blob, unkomprimiert) unter `id`. Best-effort. */
export async function putOriginal(id: string, blob: Blob): Promise<void> {
	if (!hasIDB()) return;
	try {
		const db = await openDB();
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(ORIGINALS, 'readwrite');
			tx.objectStore(ORIGINALS).put(blob, id);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		});
	} catch {
		/* ignore — Thumbnail bleibt als Fallback */
	}
}

/**
 * Liefert eine Object-URL fürs Original (Vollbild). Caller MUSS sie nach Gebrauch
 * mit URL.revokeObjectURL() freigeben. Gibt null zurück, wenn kein Original existiert.
 */
export async function getOriginalObjectUrl(id: string): Promise<string | null> {
	if (!hasIDB()) return null;
	try {
		const db = await openDB();
		const blob = await new Promise<Blob | null>((resolve) => {
			const tx = db.transaction(ORIGINALS, 'readonly');
			const req = tx.objectStore(ORIGINALS).get(id);
			req.onsuccess = () => resolve((req.result as Blob) ?? null);
			req.onerror = () => resolve(null);
		});
		return blob ? URL.createObjectURL(blob) : null;
	} catch {
		return null;
	}
}

/** Alle Fotos als {id: dataUrl} — für Backup-Export. */
export async function getAllPhotos(): Promise<Record<string, string>> {
	if (!hasIDB()) return {};
	try {
		const db = await openDB();
		return await new Promise((resolve) => {
			const out: Record<string, string> = {};
			const tx = db.transaction(STORE, 'readonly');
			const req = tx.objectStore(STORE).openCursor();
			req.onsuccess = () => {
				const cur = req.result;
				if (cur) {
					out[cur.key as string] = cur.value as string;
					cur.continue();
				} else {
					resolve(out);
				}
			};
			req.onerror = () => resolve(out);
		});
	} catch {
		return {};
	}
}

/** Mehrere Fotos schreiben — für Backup-Import. */
export async function putPhotos(map: Record<string, string>): Promise<void> {
	if (!hasIDB()) return;
	const entries = Object.entries(map);
	if (!entries.length) return;
	try {
		const db = await openDB();
		await new Promise<void>((resolve) => {
			const tx = db.transaction(STORE, 'readwrite');
			const os = tx.objectStore(STORE);
			for (const [id, url] of entries) os.put(url, id);
			tx.oncomplete = () => resolve();
			tx.onerror = () => resolve();
			tx.onabort = () => resolve();
		});
	} catch {
		/* ignore */
	}
}
