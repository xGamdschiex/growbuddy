// Headless screenshot script for Play Store assets
// Run: node play-store/capture-screenshots.mjs
// Requires dev server running on :5174 (or set BASE_URL)

import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const OUT = resolve(__dirname, 'screenshots');
mkdirSync(OUT, { recursive: true });

// Pixel-7-like: 540×1170 logical → 2x DPR = 1080×2340. Play Store: 1080×1920 (16:9)
const WIDTH = 540;
const HEIGHT = 960;
const DPR = 2; // → 1080×1920

const shots = [
	{ name: '01-dashboard', path: '/' },
	{ name: '02-calc', path: '/calc' },
	{ name: '03-tools', path: '/tools' },
	{ name: '04-vpd', path: '/tools/vpd' },
	{ name: '05-doctor', path: '/tools/doctor' }
];

(async () => {
	const browser = await puppeteer.launch({
		headless: 'new',
		args: ['--no-sandbox', '--disable-dev-shm-usage']
	});
	const page = await browser.newPage();
	await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
	await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);

	// Seed localStorage before navigation: skip onboarding
	await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
	await page.evaluate(() => {
		localStorage.setItem('growbuddy_onboarding', JSON.stringify({
			completed: true, experience: 'intermediate', goal: 'improve', completedAt: new Date().toISOString()
		}));
		localStorage.setItem('growbuddy_user_prefs', JSON.stringify({ language: 'de', theme: 'dark' }));
		// Seed a sample grow so dashboard/grow look populated
		const now = Date.now();
		localStorage.setItem('growbuddy_grows', JSON.stringify([{
			id: 'demo-1', name: 'White Widow #1', strain: 'White Widow', type: 'photo',
			phase: 'bluete', startedAt: now - 1000*60*60*24*45, plantCount: 2, medium: 'coco',
			notes: '', photos: [], checkins: []
		}]));
		localStorage.setItem('growbuddy_streak', JSON.stringify({
			current: 12, longest: 18, lastCheckinDate: new Date(now).toISOString().slice(0,10),
			totalCheckins: 47, multiplier: 2
		}));
	});

	for (const s of shots) {
		const url = `${BASE_URL}${s.path}`;
		console.log(`→ ${url}`);
		try {
			await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
			await new Promise(r => setTimeout(r, 2000));
			const file = resolve(OUT, `${s.name}.png`);
			await page.screenshot({ path: file, fullPage: false });
			console.log(`  ✓ ${file}`);
		} catch (e) {
			console.error(`  ✗ ${s.name}: ${e.message}`);
		}
	}

	await browser.close();
})();
