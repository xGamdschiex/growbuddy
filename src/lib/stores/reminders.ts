/**
 * Reminders Store — Lokale Check-in Erinnerungen via Notification API.
 * Kein Server nötig — läuft komplett im Browser/PWA.
 */

import { writable } from 'svelte/store';

export interface ReminderSettings {
	enabled: boolean;
	time: string;          // "19:00" — Uhrzeit für tägliche Erinnerung
	permission: NotificationPermission | 'default';
}

const STORAGE_KEY = 'growbuddy_reminders';

const DEFAULTS: ReminderSettings = {
	enabled: false,
	time: '19:00',
	permission: 'default',
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

function createReminderStore() {
	const { subscribe, set, update } = writable<ReminderSettings>(loadState());
	subscribe(s => {
		if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
	});

	let timerId: ReturnType<typeof setTimeout> | null = null;

	function scheduleNext(time: string) {
		if (timerId) clearTimeout(timerId);
		if (typeof window === 'undefined') return;

		const [hours, minutes] = time.split(':').map(Number);
		const now = new Date();
		const target = new Date();
		target.setHours(hours, minutes, 0, 0);

		// Wenn Zeitpunkt heute schon vorbei → morgen
		if (target <= now) target.setDate(target.getDate() + 1);

		const delay = target.getTime() - now.getTime();

		timerId = setTimeout(() => {
			showNotification();
			// Nächsten Tag schedulen
			scheduleNext(time);
		}, delay);
	}

	function showNotification() {
		if (typeof window === 'undefined') return;
		if (Notification.permission !== 'granted') return;

		new Notification('GrowBuddy Check-in', {
			body: 'Zeit für deinen täglichen Check-in! Wie geht es deinen Pflanzen?',
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			tag: 'daily-checkin',
			renotify: true,
		});
	}

	return {
		subscribe,

		async requestPermission(): Promise<boolean> {
			if (typeof window === 'undefined') return false;
			if (!('Notification' in window)) return false;

			const result = await Notification.requestPermission();
			update(s => ({ ...s, permission: result }));
			return result === 'granted';
		},

		async enable(time?: string) {
			const granted = await this.requestPermission();
			if (!granted) return;

			update(s => {
				const t = time ?? s.time;
				scheduleNext(t);
				return { ...s, enabled: true, time: t, permission: 'granted' };
			});
		},

		disable() {
			if (timerId) clearTimeout(timerId);
			timerId = null;
			update(s => ({ ...s, enabled: false }));
		},

		setTime(time: string) {
			update(s => {
				if (s.enabled) scheduleNext(time);
				return { ...s, time };
			});
		},

		/** Beim App-Start aufrufen um Timer wiederherzustellen */
		init() {
			let state = DEFAULTS;
			subscribe(s => state = s)();
			if (state.enabled && state.permission === 'granted') {
				scheduleNext(state.time);
			}
		},
	};
}

export const reminderStore = createReminderStore();
