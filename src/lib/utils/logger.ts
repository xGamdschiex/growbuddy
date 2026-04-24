/**
 * Strukturierter Logger mit Level-Filter.
 * - Production: nur `warn` + `error` landen in console
 * - Development: alles
 * - Optional: Remote-Sink (z.B. Sentry/Supabase function) via setSink().
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
	level: LogLevel;
	msg: string;
	ctx?: Record<string, unknown>;
	ts: string;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

// Dev = import.meta.env.DEV (Vite); Fallback für Node/SW
const isDev: boolean =
	typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV === true;

const minLevel: LogLevel = isDev ? 'debug' : 'warn';

type Sink = (entry: LogEntry) => void;
let sink: Sink | null = null;

/** Externen Sink registrieren (Sentry, custom endpoint). */
export function setLoggerSink(fn: Sink | null): void {
	sink = fn;
}

function emit(level: LogLevel, msg: string, ctx?: Record<string, unknown>): void {
	if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
	const entry: LogEntry = { level, msg, ctx, ts: new Date().toISOString() };
	// eslint-disable-next-line no-console
	const c = (console as any)[level] ?? console.log;
	if (ctx) c(`[${level}] ${msg}`, ctx);
	else c(`[${level}] ${msg}`);
	try { sink?.(entry); } catch { /* sink darf nie crashen */ }
}

export const logger = {
	debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', msg, ctx),
	info: (msg: string, ctx?: Record<string, unknown>) => emit('info', msg, ctx),
	warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', msg, ctx),
	error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, ctx),
};
