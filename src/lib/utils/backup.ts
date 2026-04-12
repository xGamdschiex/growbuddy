/**
 * Daten-Backup — JSON Export/Import aller localStorage-Daten
 */

const BACKUP_KEYS = [
	'growbuddy_grows',
	'growbuddy_xp',
	'growbuddy_pro',
	'growbuddy_onboarding',
	'growbuddy_reminders',
	'growbuddy_locale',
	'growbuddy_drying_start',
	'growbuddy_curing_start',
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

/** Download als JSON-Datei */
export function downloadBackup(): void {
	const json = exportBackup();
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `growbuddy-backup-${new Date().toISOString().slice(0, 10)}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
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
