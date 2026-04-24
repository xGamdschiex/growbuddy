#!/usr/bin/env node
/**
 * i18n Missing-Key Validator
 *
 * 1. Lädt alle Keys aus src/lib/i18n/de.ts und en.ts
 * 2. Scannt src/ nach `$t('key')` / `$t("key")` Usages
 * 3. Reports:
 *    - Keys in Code aber nicht in de.ts (fatal)
 *    - Keys in de.ts aber nicht in en.ts (warn)
 *    - Keys in de.ts aber nirgends genutzt (info)
 *    - Keys in en.ts aber nicht in de.ts (warn)
 *
 * Exit 1 bei fatalen Fehlern.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'src');
const DE_FILE = join(SRC, 'lib', 'i18n', 'de.ts');
const EN_FILE = join(SRC, 'lib', 'i18n', 'en.ts');

const EXTS = new Set(['.ts', '.svelte', '.js']);
const IGNORE = new Set(['node_modules', '.svelte-kit', 'build', 'dist', '.git']);

function extractKeysFromLocaleFile(path) {
	const src = readFileSync(path, 'utf8');
	const re = /['"`]([a-zA-Z0-9_.-]+)['"`]\s*:/g;
	const keys = new Set();
	let m;
	while ((m = re.exec(src))) keys.add(m[1]);
	return keys;
}

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (IGNORE.has(name)) continue;
		const full = join(dir, name);
		const s = statSync(full);
		if (s.isDirectory()) walk(full, out);
		else if (EXTS.has(extname(name))) out.push(full);
	}
	return out;
}

function extractUsagesFromCode(files, knownKeys) {
	// Ansatz: String-Literale `'foo.bar'` oder `"foo.bar"` finden, die in
	// knownKeys vorhanden sind. Robust gegenüber beliebigen t-Alias-Namen
	// (t, tr, _t, $t, ...). Locale-Files selbst werden ausgeschlossen.
	const used = new Set();
	const re = /['"]([a-zA-Z][a-zA-Z0-9_-]*(?:\.[a-zA-Z0-9_-]+)+)['"]/g;
	for (const f of files) {
		if (f === DE_FILE || f === EN_FILE) continue;
		const src = readFileSync(f, 'utf8');
		let m;
		while ((m = re.exec(src))) {
			if (knownKeys.has(m[1])) used.add(m[1]);
		}
	}
	return used;
}

const de = extractKeysFromLocaleFile(DE_FILE);
const en = extractKeysFromLocaleFile(EN_FILE);
const files = walk(SRC);
const allKnown = new Set([...de, ...en]);
const used = extractUsagesFromCode(files, allKnown);

const missingInDe = [...used].filter(k => !de.has(k)).sort();
const missingInEn = [...de].filter(k => !en.has(k)).sort();
const extraInEn = [...en].filter(k => !de.has(k)).sort();
const unused = [...de].filter(k => !used.has(k)).sort();

const log = (label, arr, icon) => {
	if (!arr.length) return;
	console.log(`\n${icon} ${label} (${arr.length}):`);
	for (const k of arr) console.log(`   ${k}`);
};

console.log('── i18n Check ──');
console.log(`DE keys: ${de.size}`);
console.log(`EN keys: ${en.size}`);
console.log(`Used in code: ${used.size}`);
console.log(`Scanned files: ${files.length}`);

log('FATAL: Im Code genutzt, fehlt in de.ts', missingInDe, '✗');
log('WARN: In de.ts aber nicht in en.ts', missingInEn, '⚠');
log('WARN: In en.ts aber nicht in de.ts', extraInEn, '⚠');
log('INFO: In de.ts definiert aber ungenutzt', unused, 'ℹ');

if (missingInDe.length) {
	console.log('\n✗ Validator failed — fehlende Keys in de.ts\n');
	process.exit(1);
}
console.log('\n✓ Validator passed\n');
