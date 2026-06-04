import { describe, it, expect, vi } from 'vitest';
import { debounce, throttle } from './debounce';

describe('debounce', () => {
	it('triggert erst nach der Wartezeit', async () => {
		const fn = vi.fn();
		const d = debounce(fn, 50);
		d('a');
		d('b');
		d('c');
		expect(fn).not.toHaveBeenCalled();
		await new Promise(r => setTimeout(r, 80));
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('c'); // letzter Aufruf gewinnt
	});

	it('resettet bei neuem Call', async () => {
		const fn = vi.fn();
		const d = debounce(fn, 50);
		d('a');
		await new Promise(r => setTimeout(r, 30));
		d('b'); // resettet timer
		await new Promise(r => setTimeout(r, 30));
		expect(fn).not.toHaveBeenCalled();
		await new Promise(r => setTimeout(r, 30));
		expect(fn).toHaveBeenCalledWith('b');
	});
});

describe('throttle', () => {
	it('erster Call sofort', () => {
		const fn = vi.fn();
		const t = throttle(fn, 50);
		t('a');
		expect(fn).toHaveBeenCalledWith('a');
	});

	it('zweiter Call innerhalb Window erst nach Ablauf', async () => {
		const fn = vi.fn();
		const t = throttle(fn, 50);
		t('a');
		t('b');
		t('c');
		expect(fn).toHaveBeenCalledTimes(1);
		await new Promise(r => setTimeout(r, 80));
		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn).toHaveBeenLastCalledWith('c');
	});
});
