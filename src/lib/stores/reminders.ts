/**
 * Reminders Store — Tägliche Check-in-Erinnerungen.
 * Hybrid-Ansatz:
 *  - Capacitor Local Notifications (Android APK) → echte native Reminder
 *  - Service Worker + Notification API (PWA) → funktioniert solange SW aktiv
 *  - setTimeout-Fallback (Browser-Tab offen)
 * Zusätzlich: "Missed Check-in" beim App-Start prüfen und sofort Toast/Notification.
 */

import { writable } from 'svelte/store';

export interface ReminderSettings {
	enabled: boolean;
	time: string;          // "19:00"
	permission: NotificationPermission | 'default';
	streak_alerts: boolean; // Extra-Reminder wenn Streak in Gefahr
}

const STORAGE_KEY = 'growbuddy_reminders';

const DEFAULTS: ReminderSettings = {
	enabled: false,
	time: '19:00',
	permission: 'default',
	streak_alerts: true,
};

function loadState(): ReminderSettings {
	if (typeof window === 'undefined') return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		return { ...DEFAULTS, ...JSON.parse(raw) };
	} catch {
		return DEFAULTS;
	}
}

// Capacitor Detection
function isNative(): boolean {
	return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

async function getCapacitorNotifications() {
	if (!isNative()) return null;
	try {
		const mod = await import('@capacitor/local-notifications');
		return mod.LocalNotifications;
	} catch {
		return null;
	}
}

async function scheduleCapacitor(time: string, streakAlerts: boolean): Promise<boolean> {
	const LN = await getCapacitorNotifications();
	if (!LN) return false;

	const perm = await LN.requestPermissions();
	if (perm.display !== 'granted') return false;

	// Alle bestehenden Notifications löschen
	const pending = await LN.getPending();
	if (pending.notifications.length > 0) {
		await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
	}

	const [hours, minutes] = time.split(':').map(Number);
	const notifications: any[] = [
		{
			id: 1,
			title: '🌱 GrowBuddy Check-in',
			body: 'Zeit für deinen täglichen Check-in! Wie geht es deinen Pflanzen?',
			schedule: { on: { hour: hours, minute: minutes }, allowWhileIdle: true, repeats: true },
			smallIcon: 'ic_stat_icon_config_sample',
		},
	];

	if (streakAlerts) {
		// Streak-Warning-Notification 2h vor Mitternacht wenn noch kein Check-in
		notifications.push({
			id: 2,
			title: '🔥 Streak in Gefahr!',
			body: 'Noch kein Check-in heute — dein Streak läuft aus!',
			schedule: { on: { hour: 22, minute: 0 }, allowWhileIdle: true, repeats: true },
			smallIcon: 'ic_stat_icon_config_sample',
		});
	}

	await LN.schedule({ notifications });
	return true;
}

function createReminderStore() {
	const { subscribe, set, update } = writable<ReminderSettings>(loadState());
	subscribe(s => {
		if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
	});

	let timerId: ReturnType<typeof setTimeout> | null = null;

	function scheduleWebTimer(time: string) {
		if (timerId) clearTimeout(timerId);
		if (typeof window === 'undefined') return;

		const [hours, minutes] = time.split(':').map(Number);
		const now = new Date();
		const target = new Date();
		target.setHours(hours, minutes, 0, 0);
		if (target <= now) target.setDate(target.getDate() + 1);

		const delay = target.getTime() - now.getTime();
		timerId = setTimeout(() => {
			showWebNotification();
			scheduleWebTimer(time);
		}, delay);
	}

	async function showWebNotification(title = '🌱 GrowBuddy Check-in', body = 'Zeit für deinen täglichen Check-in! Wie geht es deinen Pflanzen?') {
		if (typeof window === 'undefined') return;
		if (Notification.permission !== 'granted') return;

		// Via Service Worker registrieren wenn möglich (persistenter)
		try {
			if ('serviceWorker' in navigator) {
				const reg = await navigator.serviceWorker.ready;
				await reg.showNotification(title, {
					body,
					icon: '/icon-192.png',
					badge: '/icon-192.png',
					tag: 'daily-checkin',
					renotify: true,
					data: { url: '/' },
				});
				return;
			}
		} catch {}

		// Fallback: direkte Notification
		new Notification(title, {
			body,
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			tag: 'daily-checkin',
		});
	}

	return {
		subscribe,

		async requestPermission(): Promise<boolean> {
			if (typeof window === 'undefined') return false;

			if (isNative()) {
				const LN = await getCapacitorNotifications();
				if (!LN) return false;
				const r = await LN.requestPermissions();
				const granted = r.display === 'granted';
				update(s => ({ ...s, permission: granted ? 'granted' : 'denied' }));
				return granted;
			}

			if (!('Notification' in window)) return false;
			const result = await Notification.requestPermission();
			update(s => ({ ...s, permission: result }));
			return result === 'granted';
		},

		async enable(time?: string) {
			const granted = await this.requestPermission();
			if (!granted) return;

			let state = DEFAULTS;
			subscribe(s => state = s)();
			const t = time ?? state.time;

			if (isNative()) {
				await scheduleCapacitor(t, state.streak_alerts);
			} else {
				scheduleWebTimer(t);
			}

			update(s => ({ ...s, enabled: true, time: t, permission: 'granted' }));
		},

		async disable() {
			if (timerId) clearTimeout(timerId);
			timerId = null;

			if (isNative()) {
				const LN = await getCapacitorNotifications();
				if (LN) {
					const pending = await LN.getPending();
					if (pending.notifications.length > 0) {
						await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
					}
				}
			}

			update(s => ({ ...s, enabled: false }));
		},

		async setTime(time: string) {
			let state = DEFAULTS;
			subscribe(s => state = s)();

			if (state.enabled) {
				if (isNative()) {
					await scheduleCapacitor(time, state.streak_alerts);
				} else {
					scheduleWebTimer(time);
				}
			}
			update(s => ({ ...s, time }));
		},

		async setStreakAlerts(enabled: boolean) {
			let state = DEFAULTS;
			subscribe(s => state = s)();
			update(s => ({ ...s, streak_alerts: enabled }));
			if (state.enabled && isNative()) {
				await scheduleCapacitor(state.time, enabled);
			}
		},

		/** Zeigt sofortige Reminder-Notification wenn heute kein Check-in war */
		async checkMissedToday(hasCheckinToday: boolean, streakCount: number) {
			if (hasCheckinToday) return;
			if (typeof window === 'undefined') return;
			let state = DEFAULTS;
			subscribe(s => state = s)();
			if (!state.enabled) return;

			// Nur wenn bereits nach Reminder-Zeit heute
			const [hours, minutes] = state.time.split(':').map(Number);
			const now = new Date();
			const reminderTime = new Date();
			reminderTime.setHours(hours, minutes, 0, 0);
			if (now < reminderTime) return;

			const title = streakCount > 0 ? '🔥 Streak retten!' : '🌱 GrowBuddy Check-in';
			const body = streakCount > 0
				? `Dein ${streakCount}-Tage-Streak läuft aus — schnell einen Check-in machen!`
				: 'Heute noch keinen Check-in gemacht. Mach jetzt weiter!';
			await showWebNotification(title, body);
		},

		/** Beim App-Start aufrufen — stellt Timer wieder her */
		init() {
			let state = DEFAULTS;
			subscribe(s => state = s)();
			if (state.enabled && state.permission === 'granted' && !isNative()) {
				scheduleWebTimer(state.time);
			}
		},
	};
}

export const reminderStore = createReminderStore();
