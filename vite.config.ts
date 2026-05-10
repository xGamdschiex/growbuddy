import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const APP_VERSION = pkg.version as string;

/**
 * Injiziert die Version aus package.json in static/sw.js
 * (Template-Platzhalter __APP_VERSION__). Läuft pre-build.
 */
function swVersionPlugin(): Plugin {
	return {
		name: 'gb-sw-version',
		apply: 'build',
		buildStart() {
			const swPath = join(process.cwd(), 'static', 'sw.js');
			let src = readFileSync(swPath, 'utf8');
			src = src.replace(/growbuddy-v[\w.-]+/g, `growbuddy-v${APP_VERSION}`);
			writeFileSync(swPath, src);
		},
	};
}

// TODO Mary-Jane Follow-up: Console-Strip für Production-Build.
// Naive Regex zerschießt mehrzeilige `console.log({\n...})`-Calls.
// Optionen:
//   1. utils/logger.ts überall konsequent statt console.log nutzen
//      (Logger no-op in Production)
//   2. AST-basiertes vite-plugin-remove-console (Dependency)
//   3. Vite 8 oxc.drop sobald upstream supportet wird
// Vite 8 + oxc hat aktuell kein drop-Support; esbuild.drop wird ignoriert.

export default defineConfig(() => {
	return {
		plugins: [tailwindcss(), sveltekit(), swVersionPlugin()],
		define: {
			__APP_VERSION__: JSON.stringify(APP_VERSION),
		},
	};
});
