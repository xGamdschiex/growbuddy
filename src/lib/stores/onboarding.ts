/**
 * Onboarding Store — Trackt ob der User das Onboarding gesehen hat.
 */

import { writable } from 'svelte/store';

const STORAGE_KEY = 'growbuddy_onboarding';

interface OnboardingState {
	completed: boolean;
	experience: 'beginner' | 'intermediate' | 'advanced' | null;
	goal: 'first_grow' | 'improve' | 'document' | 'commercial' | null;
}

const DEFAULTS: OnboardingState = {
	completed: false,
	experience: null,
	goal: null,
};

function loadState(): OnboardingState {
	if (typeof window === 'undefined') return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		return { ...DEFAULTS, ...JSON.parse(raw) };
	} catch {
		return DEFAULTS;
	}
}

function createOnboardingStore() {
	const { subscribe, set, update } = writable<OnboardingState>(loadState());
	subscribe(s => {
		if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
	});

	return {
		subscribe,
		complete(experience: OnboardingState['experience'], goal: OnboardingState['goal']) {
			update(s => ({ ...s, completed: true, experience, goal }));
		},
		reset() { set(DEFAULTS); },
	};
}

export const onboardingStore = createOnboardingStore();
