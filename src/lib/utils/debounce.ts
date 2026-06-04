/**
 * Debounce-Helper für UI-Events (z.B. input → store).
 *
 * Usage:
 *   const debouncedSet = debounce((value: number) => store.set(value), 200);
 *   <input oninput={(e) => debouncedSet(Number(e.target.value))} />
 *
 * Wichtig: jeder Konsument braucht eine eigene Debounce-Instanz — die Funktion
 * speichert internal den Timeout-Handle.
 */
export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number): (...args: Args) => void {
	let handle: ReturnType<typeof setTimeout> | null = null;
	return (...args: Args) => {
		if (handle !== null) clearTimeout(handle);
		handle = setTimeout(() => {
			handle = null;
			fn(...args);
		}, ms);
	};
}

/**
 * Throttle: erste Ausführung sofort, dann max. 1× pro `ms` weitere.
 * Anders als debounce — gut für visuelle Updates die immer Feedback geben sollen.
 */
export function throttle<Args extends unknown[]>(fn: (...args: Args) => void, ms: number): (...args: Args) => void {
	let last = 0;
	let pending: ReturnType<typeof setTimeout> | null = null;
	let lastArgs: Args | null = null;
	return (...args: Args) => {
		const now = Date.now();
		lastArgs = args;
		if (now - last >= ms) {
			last = now;
			fn(...args);
		} else if (pending === null) {
			pending = setTimeout(() => {
				pending = null;
				last = Date.now();
				if (lastArgs) fn(...lastArgs);
			}, ms - (now - last));
		}
	};
}
