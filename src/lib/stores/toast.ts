/**
 * Toast Store — Lightweight notifications für XP-Gains, Achievements, etc.
 */

import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	message: string;
	type: 'xp' | 'achievement' | 'info' | 'success' | 'warning' | 'error';
	icon?: string;
	duration?: number; // ms, default 3000
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	function add(toast: Omit<Toast, 'id'>) {
		const id = Math.random().toString(36).slice(2);
		const duration = toast.duration ?? 3000;
		update(ts => [...ts, { ...toast, id }]);
		setTimeout(() => remove(id), duration);
	}

	function remove(id: string) {
		update(ts => ts.filter(t => t.id !== id));
	}

	return {
		subscribe,
		add,
		remove,
		xp(amount: number, reason: string) {
			add({ message: `+${amount} XP — ${reason}`, type: 'xp', icon: '⚡' });
		},
		achievement(name: string) {
			add({ message: `Achievement: ${name}`, type: 'achievement', icon: '🏆', duration: 4000 });
		},
		success(message: string) {
			add({ message, type: 'success', icon: '✓' });
		},
		info(message: string) {
			add({ message, type: 'info' });
		},
		warning(message: string) {
			add({ message, type: 'warning', icon: '⚠️', duration: 4000 });
		},
		error(message: string) {
			add({ message, type: 'error', icon: '⛔', duration: 5000 });
		},
	};
}

export const toastStore = createToastStore();
