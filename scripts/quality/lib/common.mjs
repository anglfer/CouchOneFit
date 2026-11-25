// Utilidades compartidas por las herramientas de calidad (sin dependencias).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

// Percentil por rango más cercano (nearest-rank) sobre valores numéricos.
// rank = ceil(p / 100 * n), acotado a [1, n]; sin datos devuelve null.
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(
    sorted.length,
    Math.max(1, Math.ceil((p / 100) * sorted.length))
  );
  return sorted[rank - 1];
}

// Bucle en vez de Math.min(...v): el spread desborda la pila con ~10^5 valores.
export function extent(values) {
  if (!values.length) return { min: null, max: null };
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

export function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function round(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function truncate(text, max) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function toPosix(file) {
  return String(file).replaceAll('\\', '/');
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLocalHost(hostname) {
  return LOCAL_HOSTS.has(String(hostname).toLowerCase());
}

export function isLocalUrl(value) {
  try {
    return isLocalHost(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function appendJsonl(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
}

// Comprime cada *.jsonl de la carpeta a .jsonl.gz; el original se borra solo
// después de escribir el comprimido.
export function gzipJsonlFiles(dir) {
  const files = [];
  collectJsonlFiles(dir, files, []);
  for (const file of files.filter((item) => item.endsWith('.jsonl'))) {
    fs.writeFileSync(`${file}.gz`, zlib.gzipSync(fs.readFileSync(file)));
    fs.rmSync(file);
  }
}

function collectJsonlFiles(input, found, missing) {
  let stat;
  try {
    stat = fs.statSync(input);
  } catch {
    missing.push(input);
    return;
  }
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(input).sort()) {
      const child = path.join(input, entry);
      const childStat = fs.statSync(child);
      if (childStat.isDirectory()) collectJsonlFiles(child, found, missing);
      else if (/\.jsonl(\.gz)?$/.test(entry)) found.push(child);
    }
  } else {
    found.push(input);
  }
}

// Lee archivos o directorios (*.jsonl, recursivo). Las líneas mal formadas se
// cuentan en `malformedLines` y nunca interrumpen la lectura.
export function readJsonlInputs(inputs) {
  const files = [];
  const missing = [];
  for (const input of inputs) collectJsonlFiles(input, files, missing);
  const events = [];
  let malformedLines = 0;
  for (const file of files) {
    const raw = fs.readFileSync(file);
    const text = (file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw)
      .toString('utf8')
      .replace(/^﻿/, '');
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          events.push(parsed);
        } else {
          malformedLines += 1;
        }
      } catch {
        malformedLines += 1;
      }
    }
  }
  return { events, files, missing, malformedLines };
}

export function parseCliArgs(argv, { multi = [], flags = [] } = {}) {
  const options = {};
  for (const key of multi) options[key] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new Error(`Argumento inesperado: ${arg}`);
    const key = arg.slice(2);
    if (flags.includes(key)) {
      options[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Falta el valor de --${key}`);
    }
    index += 1;
    if (multi.includes(key)) options[key].push(value);
    else options[key] = value;
  }
  return options;
}
