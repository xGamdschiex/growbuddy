#!/usr/bin/env node
// Monitor GrowBuddy on device via WiFi-ADB
// Runs in background, writes rotating logs + captures on crash
//
// Usage: node monitoring/watch.mjs
// Stop: Ctrl-C

import { spawn, execSync } from 'child_process';
import { createWriteStream, mkdirSync, existsSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEVICE = '192.168.2.62:5555';
const PACKAGE = 'app.growbuddy.de';
const ADB = resolve('C:/Users/lauri/AppData/Local/Android/Sdk/platform-tools/adb.exe');
const LOG_DIR = resolve(__dirname, 'logs');
const SHOT_DIR = resolve(__dirname, 'screenshots');
mkdirSync(LOG_DIR, { recursive: true });
mkdirSync(SHOT_DIR, { recursive: true });

function today() {
	return new Date().toISOString().slice(0, 10);
}
function now() {
	return new Date().toISOString().replace(/[:.]/g, '-');
}

function log(msg) {
	const line = `[${new Date().toISOString()}] ${msg}`;
	console.log(line);
	appendFileSync(resolve(LOG_DIR, 'monitor.log'), line + '\n');
}

function isConnected() {
	try {
		const out = execSync(`"${ADB}" devices`, { encoding: 'utf8' });
		return out.includes(DEVICE) && out.includes('device\r') === false
			? out.split('\n').some(l => l.startsWith(DEVICE) && l.includes('device'))
			: true;
	} catch {
		return false;
	}
}

function reconnect() {
	log('Reconnecting...');
	try {
		execSync(`"${ADB}" connect ${DEVICE}`, { encoding: 'utf8', timeout: 10000 });
		return isConnected();
	} catch (e) {
		log(`Reconnect failed: ${e.message}`);
		return false;
	}
}

function autoScreenshot(reason) {
	const file = resolve(SHOT_DIR, `${now()}_${reason}.png`);
	try {
		execSync(`"${ADB}" -s ${DEVICE} exec-out screencap -p > "${file}"`, { shell: true, timeout: 10000 });
		log(`Screenshot saved: ${file}`);
	} catch (e) {
		log(`Screenshot failed: ${e.message}`);
	}
}

function startLogcat() {
	const logFile = resolve(LOG_DIR, `logcat-${today()}.log`);
	const crashFile = resolve(LOG_DIR, 'crashes.log');
	log(`Starting logcat → ${logFile}`);

	// Clear log buffer first
	try { execSync(`"${ADB}" -s ${DEVICE} logcat -c`); } catch {}

	const proc = spawn(ADB, ['-s', DEVICE, 'logcat', '-v', 'threadtime', `${PACKAGE}:V`, 'AndroidRuntime:E', 'ActivityManager:I', '*:S'], {
		stdio: ['ignore', 'pipe', 'pipe']
	});

	const logStream = createWriteStream(logFile, { flags: 'a' });
	proc.stdout.pipe(logStream);

	proc.stdout.on('data', (chunk) => {
		const s = chunk.toString();
		if (/FATAL EXCEPTION|AndroidRuntime.*FATAL|ANR in/i.test(s)) {
			log(`⚠ CRASH DETECTED: ${s.slice(0, 200)}`);
			appendFileSync(crashFile, `\n=== ${new Date().toISOString()} ===\n${s}\n`);
			autoScreenshot('crash');
		}
	});

	proc.on('exit', (code) => {
		log(`Logcat exited (code ${code}), reconnecting in 10s...`);
		setTimeout(() => {
			if (reconnect()) startLogcat();
			else setTimeout(() => { if (reconnect()) startLogcat(); }, 60000);
		}, 10000);
	});

	return proc;
}

// Heartbeat every 5 min
setInterval(() => {
	if (!isConnected()) {
		log('Device disconnected');
		reconnect();
	}
}, 300000);

log('=== GrowBuddy Monitor started ===');
log(`Device: ${DEVICE}`);
log(`Package: ${PACKAGE}`);
log(`Logs: ${LOG_DIR}`);
log(`Screenshots: ${SHOT_DIR}`);

if (!isConnected()) reconnect();
startLogcat();

process.on('SIGINT', () => {
	log('Monitor stopped');
	process.exit(0);
});
