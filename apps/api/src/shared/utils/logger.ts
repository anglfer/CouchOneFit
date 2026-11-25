import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogLevelSetting = LogLevel | 'silent';
export type LogRecord = Record<string, unknown>;
export type LogSink = (record: LogRecord) => void;

export interface LoggerOptions {
  level?: LogLevelSetting;
  dir?: string | null;
  retentionDays?: number;
}

const WEIGHT: Record<LogLevelSetting, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};
const SENSITIVE =
  /(pass(word)?|contrase|token|secret|authorization|cookie|csrf|otp|access_?code|activation|recovery|email|correo|phone|tel[eé]fono|nombre|name$|weight|peso|waist|cintura|hip|cadera|skinfold|pliegue|body_?fat|grasa|calor|birth_?date|fecha_?nacimiento|goal|objetivo|full_?name|body$)/i;
const SENSITIVE_TEXT_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}\b/g, '[REDACTED_JWT]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]'],
];
const SAFE_KEYS = new Set(['event', 'errorName', 'errorCode']);
const MAX_DEPTH = 4;
const MAX_STRING = 2000;
const FILE_PATTERN = /^api-(\d{4}-\d{2}-\d{2})\.jsonl$/;

let registeredSink: LogSink | null = null;

interface State {
  level: LogLevelSetting;
  dir: string | null;
  retentionDays: number;
  fd: number | null;
  fdDay: string | null;
  warned: boolean;
}

let state: State | null = null;

function parseLevel(value: string | undefined): LogLevelSetting | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized in WEIGHT
    ? (normalized as LogLevelSetting)
    : undefined;
}

function fromEnv(): State {
  const dir = process.env.LOG_DIR?.trim() || null;
  const retention = Number(process.env.LOG_RETENTION_DAYS);
  return {
    level:
      parseLevel(process.env.LOG_LEVEL) ??
      (process.env.NODE_TEST_CONTEXT && !dir ? 'silent' : 'info'),
    dir,
    retentionDays:
      Number.isFinite(retention) && retention > 0 ? retention : 14,
    fd: null,
    fdDay: null,
    warned: false,
  };
}

function current(): State {
  state ??= fromEnv();
  return state;
}

function closeFd(s: State): void {
  if (s.fd !== null) {
    try {
      fs.closeSync(s.fd);
    } catch {
      // Cerrar un descriptor ya inválido no debe afectar a la API.
    }
  }
  s.fd = null;
  s.fdDay = null;
}

export function configureLogger(options: LoggerOptions = {}): void {
  const previous = state;
  if (previous) closeFd(previous);
  const base = fromEnv();
  state = {
    ...base,
    ...(options.level !== undefined ? { level: options.level } : {}),
    ...(options.dir !== undefined ? { dir: options.dir } : {}),
    ...(options.retentionDays !== undefined
      ? { retentionDays: options.retentionDays }
      : {}),
  };
}

function serializeError(error: Error): Record<string, unknown> {
  const code = (error as { code?: unknown }).code;
  return {
    name: error.name,
    message: error.message,
    ...(code !== undefined ? { code } : {}),
  };
}

function redactString(value: string): string {
  let clean = value;
  for (const [pattern, replacement] of SENSITIVE_TEXT_PATTERNS) {
    clean = clean.replace(pattern, replacement);
  }
  return clean.length > MAX_STRING ? clean.slice(0, MAX_STRING) : clean;
}

function sanitize(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol')
    return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (value instanceof Error) {
    // El nombre/código del error no es sensible: no pasa por la redacción por clave.
    const { name, message, code } = serializeError(value);
    return { name, message: sanitize(message, depth + 1), code };
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] =
      !SAFE_KEYS.has(key) && SENSITIVE.test(key)
        ? '[REDACTED]'
        : sanitize(item, depth + 1);
  }
  return out;
}

function pruneOld(s: State, today: string): void {
  if (!s.dir) return;
  const limit = Date.parse(`${today}T00:00:00Z`) - s.retentionDays * 86_400_000;
  for (const name of fs.readdirSync(s.dir)) {
    const match = FILE_PATTERN.exec(name);
    if (!match) continue;
    const fileDay = Date.parse(`${match[1]}T00:00:00Z`);
    if (Number.isFinite(fileDay) && fileDay < limit) {
      try {
        fs.unlinkSync(path.join(s.dir, name));
      } catch {
        // Un archivo bloqueado se reintenta en la próxima rotación.
      }
    }
  }
}

function openFor(s: State, day: string): number {
  if (s.fd !== null && s.fdDay === day) return s.fd;
  closeFd(s);
  fs.mkdirSync(s.dir as string, { recursive: true });
  s.fd = fs.openSync(path.join(s.dir as string, `api-${day}.jsonl`), 'a');
  s.fdDay = day;
  try {
    pruneOld(s, day);
  } catch {
    // La retención no debe impedir escribir: se reintenta en la próxima rotación.
  }
  return s.fd;
}

export function sanitizeLogValue(value: unknown): unknown {
  return sanitize(value, 0);
}

export function registerLogSink(sink: LogSink | null): void {
  registeredSink = sink;
}

function write(level: LogLevel, event: string, fields?: Record<string, unknown>) {
  const s = current();
  const shouldEmitText = WEIGHT[level] >= WEIGHT[s.level];
  if (!shouldEmitText && !registeredSink) return;
  try {
    const now = new Date();
    const record: Record<string, unknown> = {
      id: randomUUID(),
      ts: now.toISOString(),
      level: level.toUpperCase(),
      service: 'api',
      env: process.env.OBSERVABILITY_ENV || process.env.NODE_ENV || 'development',
      event,
      version:
        process.env.APP_VERSION ||
        process.env.RENDER_GIT_COMMIT?.slice(0, 8) ||
        undefined,
    };
    if (record.version === undefined) delete record.version;
    const clean = sanitize(fields ?? {}, 0) as Record<string, unknown>;
    for (const [key, item] of Object.entries(clean)) {
      if (!(key in record) && item !== undefined) record[key] = item;
    }
    if (registeredSink) {
      try {
        registeredSink(record);
      } catch {
        // El sink nunca debe interrumpir el logger ni generar recursividad.
      }
    }
    if (!shouldEmitText) return;
    const line = `${JSON.stringify(record)}\n`;
    if (s.dir) {
      // shortcut: synchronous append (crash-safe, ~µs per line); switch to a buffered async stream if logging shows up in latency profiles.
      fs.writeSync(openFor(s, now.toISOString().slice(0, 10)), line);
    } else {
      process.stdout.write(line);
    }
  } catch (error) {
    if (!s.warned) {
      s.warned = true;
      try {
        process.stderr.write(
          `Logger: no se pudo escribir el registro (${
            error instanceof Error ? error.name : 'error'
          }); se descartan las líneas fallidas.\n`
        );
      } catch {
        // Sin destino alternativo: se descarta.
      }
    }
    closeFd(s);
  }
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) =>
    write('debug', event, fields),
  info: (event: string, fields?: Record<string, unknown>) =>
    write('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) =>
    write('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) =>
    write('error', event, fields),
};

export function writeLog(
  level: LogLevel,
  event: string,
  fields?: Record<string, unknown>
): void {
  write(level, event, fields);
}
