/**
 * Daten-Backup — JSON Export/Import aller localStorage-Daten
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const BACKUP_KEYS = [
	'growbuddy_grows',
	'growbuddy_xp',
	'growbuddy_pro',
	'growbuddy_onboarding',
	'growbuddy_reminders',
	'growbuddy_locale',
	'growbuddy_drying_start',
	'growbuddy_curing_start',
	'growbuddy_household',
	'growbuddy_privacy',
];

export interface BackupData {
	version: string;
	created_at: string;
	data: Record<string, any>;
}

/** Exportiert alle GrowBuddy-Daten als JSON */
export function exportBackup(): string {
	const data: Record<string, any> = {};
	for (const key of BACKUP_KEYS) {
		const raw = localStorage.getItem(key);
		if (raw) {
			try {
				data[key] = JSON.parse(raw);
			} catch {
				data[key] = raw;
			}
		}
	}
	const backup: BackupData = {
		version: '1.0.0',
		created_at: new Date().toISOString(),
		data,
	};
	return JSON.stringify(backup, null, 2);
}

/** Download als JSON-Datei.
 * - Native (Capacitor Android): direkt nach /sdcard/Documents/ schreiben (auffindbar in Files-App).
 *   Capacitor 8 WebView ignoriert `<a download>`-Clicks, Filesystem-Plugin ist der saubere Weg.
 * - Web-Browser: klassischer `<a download>`-Trick.
 *
 * Returns: Pfad-Hinweis für Toast (z.B. "Dokumente/growbuddy-backup-...json")
 *          oder "Download" für Web.
 */
export async function downloadBackup(): Promise<string> {
	const json = exportBackup();
	const filename = `growbuddy-backup-${new Date().toISOString().slice(0, 10)}.json`;

	// Native (Capacitor Android/iOS)
	if (Capacitor.isNativePlatform()) {
		await Filesystem.writeFile({
			path: filename,
			data: json,
			directory: Directory.Documents,
			encoding: Encoding.UTF8,
			recursive: true,
		});
		return `Dokumente/${filename}`;
	}

	// Web-Fallback: klassischer Download
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	return 'Downloads';
}

/** Importiert Backup aus JSON-String */
export function importBackup(jsonStr: string): { success: boolean; error?: string; keys?: number } {
	try {
		const backup: BackupData = JSON.parse(jsonStr);
		if (!backup.version || !backup.data) {
			return { success: false, error: 'Ungültiges Backup-Format' };
		}
		let count = 0;
		for (const [key, value] of Object.entries(backup.data)) {
			if (BACKUP_KEYS.includes(key)) {
				localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
				count++;
			}
		}
		return { success: true, keys: count };
	} catch {
		return { success: false, error: 'JSON konnte nicht gelesen werden' };
	}
}

/** Liest eine Datei als Text */
export function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
		reader.readAsText(file);
	});
}
