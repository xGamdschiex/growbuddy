/**
 * Haptic Feedback Utility — vibriert auf unterstützten Geräten.
 * Nutzt Navigator.vibrate (PWA) oder Capacitor Haptics Plugin.
 */

export function hapticLight(): void {
	if (typeof navigator === 'undefined') return;
	try {
		navigator.vibrate?.(10);
	} catch { /* Nicht unterstützt */ }
}

export function hapticMedium(): void {
	if (typeof navigator === 'undefined') return;
	try {
		navigator.vibrate?.(25);
	} catch { /* Nicht unterstützt */ }
}

export function hapticSuccess(): void {
	if (typeof navigator === 'undefined') return;
	try {
		navigator.vibrate?.([10, 30, 10]);
	} catch { /* Nicht unterstützt */ }
}

export function hapticError(): void {
	if (typeof navigator === 'undefined') return;
	try {
		navigator.vibrate?.([50, 50, 50]);
	} catch { /* Nicht unterstützt */ }
}
