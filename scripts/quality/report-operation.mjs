// Registra una operación (respaldo, limpieza, despliegue...) en la bitácora SLA.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseCliArgs } from './lib/common.mjs';

const OPERATIONS_PATH = '/api/observability/operations';
const TIMEOUT_MS = 20_000;
const KINDS = [
  'backup',
  'access_cleanup',
  'deployment',
  'load_test',
  'storage_measurement',
];
const ENVIRONMENTS = [
  'production',
  'staging',
  'development',
  'local',
  'ci',
  'test',
];

function operationsUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (
      (url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname.replace(/\/$/, '') === ''
    ) {
      return new URL(OPERATIONS_PATH, url);
    }
  } catch {
    // El valor puede contener credenciales y nunca se imprime.
  }
  throw new Error(
    'URL inválida en OBSERVABILITY_API_URL. Usa HTTPS o HTTP local, sin ruta ni credenciales.',
  );
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseDetails(text, label) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label} no es JSON válido.`);
  }
  if (!isObject(parsed)) throw new Error(`${label} debe ser un objeto JSON.`);
  return parsed;
}

function parseOk(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('--ok debe ser true o false.');
}

export async function reportOperation({
  apiUrl = '',
  token = '',
  kind,
  environment = 'production',
  externalId,
  occurredAt = new Date().toISOString(),
  ok,
  details = {},
  fetchImpl = fetch,
} = {}) {
  if (!KINDS.includes(kind)) {
    throw new Error(`--kind debe ser uno de: ${KINDS.join(', ')}.`);
  }
  if (!ENVIRONMENTS.includes(environment)) {
    throw new Error('Ambiente de observabilidad inválido.');
  }
  if (
    typeof externalId !== 'string' ||
    !externalId.trim() ||
    externalId.length > 200
  ) {
    throw new Error('--external-id es obligatorio (máximo 200 caracteres).');
  }
  if (
    typeof occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(occurredAt))
  ) {
    throw new Error('--occurred-at debe ser una fecha ISO válida.');
  }
  if (!isObject(details)) throw new Error('details debe ser un objeto JSON.');
  if (!token) throw new Error('Falta OBSERVABILITY_INGEST_TOKEN.');
  const url = operationsUrl(apiUrl);

  const body = {
    environment,
    kind,
    occurredAt: new Date(occurredAt).toISOString(),
    externalId,
    details: ok === undefined ? details : { ...details, ok },
  };
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Observability-Token': token,
      },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      ['TimeoutError', 'AbortError'].includes(error?.name)
        ? 'Tiempo de espera agotado al registrar la operación.'
        : 'No se pudo conectar con la API de observabilidad.',
    );
  }
  let json = null;
  try {
    json = await response.json();
  } catch {
    // Respuesta sin JSON: se evalúa solo por el status.
  }
  if (response.status === 201) return { duplicate: false };
  if (response.status === 200 && json?.duplicate === true) {
    return { duplicate: true };
  }
  throw new Error(`La API rechazó el registro (HTTP ${response.status}).`);
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  let details = {};
  if (options['details-file']) {
    details = parseDetails(
      fs.readFileSync(options['details-file'], 'utf8'),
      '--details-file',
    );
  }
  if (options.details) {
    details = { ...details, ...parseDetails(options.details, '--details') };
  }
  const result = await reportOperation({
    apiUrl:
      process.env.OBSERVABILITY_API_URL || process.env.SYNTHETIC_API_URL || '',
    token: process.env.OBSERVABILITY_INGEST_TOKEN ?? '',
    kind: options.kind,
    environment: options.env ?? 'production',
    externalId: options['external-id'],
    occurredAt: options['occurred-at'],
    ok: options.ok === undefined ? undefined : parseOk(options.ok),
    details,
  });
  console.log(
    result.duplicate
      ? 'Operación ya registrada (duplicada).'
      : 'Operación registrada.',
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
