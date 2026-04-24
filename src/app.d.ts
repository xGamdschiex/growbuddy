// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
	/** Via vite `define` aus package.json injiziert (Build-Zeit). */
	const __APP_VERSION__: string;
}

export {};
