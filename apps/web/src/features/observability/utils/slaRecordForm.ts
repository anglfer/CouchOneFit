import type {
  ObservabilityEnvironment,
  SlaRecordKind,
} from '../types/observability';
import { isSlaMonth, mexicoLocalToIso } from './formatters';

export type SlaFieldType =
  'text' | 'number' | 'boolean' | 'datetime' | 'select';

export interface SlaFieldDef {
  key: string;
  label: string;
  type: SlaFieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface SlaKindDef {
  label: string;
  startLabel: string;
  /** Etiqueta del fin; null si el tipo no lo usa. */
  endLabel: string | null;
  endRequired: boolean;
  fields: SlaFieldDef[];
}

export type SlaFormValues = Record<string, string | boolean>;

const okField: SlaFieldDef = {
  key: 'ok',
  label: 'Resultado correcto',
  type: 'boolean',
};
const responsibleField: SlaFieldDef = {
  key: 'responsible',
  label: 'Responsable',
  type: 'text',
};
const noteField: SlaFieldDef = { key: 'note', label: 'Nota', type: 'text' };

export const SLA_KIND_DEFS: Record<SlaRecordKind, SlaKindDef> = {
  maintenance_window: {
    label: 'Ventana de mantenimiento',
    startLabel: 'Inicio',
    endLabel: 'Fin',
    endRequired: true,
    fields: [
      {
        key: 'notifiedAt',
        label: 'Fecha y hora del aviso',
        type: 'datetime',
        required: true,
      },
    ],
  },
  provider_incident: {
    label: 'Incidente del proveedor',
    startLabel: 'Inicio',
    endLabel: 'Fin',
    endRequired: true,
    fields: [
      {
        key: 'provider',
        label: 'Proveedor',
        type: 'select',
        required: true,
        options: [
          { value: 'render', label: 'Render' },
          { value: 'vercel', label: 'Vercel' },
          { value: 'supabase', label: 'Supabase' },
        ],
      },
      { key: 'url', label: 'Enlace al aviso del proveedor', type: 'text' },
    ],
  },
  support_incident: {
    label: 'Incidente de soporte',
    startLabel: 'Recibido',
    endLabel: 'Resuelto',
    endRequired: false,
    fields: [
      {
        key: 'severity',
        label: 'Severidad',
        type: 'select',
        required: true,
        options: [
          { value: 'alta', label: 'Alta' },
          { value: 'media', label: 'Media' },
          { value: 'baja', label: 'Baja' },
        ],
      },
      { key: 'acknowledgedAt', label: 'Acuse de recibo', type: 'datetime' },
      { key: 'cause', label: 'Causa', type: 'text', required: true },
      {
        key: 'attributable',
        label: 'Atribuible al proveedor',
        type: 'boolean',
      },
      {
        key: 'requiresRestore',
        label: 'Requiere restaurar la base de datos',
        type: 'boolean',
      },
    ],
  },
  backup: {
    label: 'Respaldo',
    startLabel: 'Fecha y hora',
    endLabel: null,
    endRequired: false,
    fields: [
      okField,
      responsibleField,
      { key: 'sizeBytes', label: 'Tamaño (bytes)', type: 'number' },
      noteField,
    ],
  },
  restore_drill: {
    label: 'Simulacro de restauración',
    startLabel: 'Inicio',
    endLabel: 'Fin',
    endRequired: true,
    fields: [okField, responsibleField, noteField],
  },
  access_cleanup: {
    label: 'Depuración de códigos caducados',
    startLabel: 'Fecha y hora',
    endLabel: null,
    endRequired: false,
    fields: [
      okField,
      responsibleField,
      { key: 'deleted', label: 'Códigos depurados', type: 'number' },
      noteField,
    ],
  },
  storage_measurement: {
    label: 'Medición de almacenamiento',
    startLabel: 'Fecha y hora',
    endLabel: null,
    endRequired: false,
    fields: [
      { key: 'bytes', label: 'Uso (bytes)', type: 'number', required: true },
      {
        key: 'limitBytes',
        label: 'Límite del plan (bytes)',
        type: 'number',
        required: true,
      },
    ],
  },
  load_test: {
    label: 'Prueba de carga',
    startLabel: 'Fecha y hora',
    endLabel: null,
    endRequired: false,
    fields: [
      { key: 'version', label: 'Versión', type: 'text', required: true },
      {
        key: 'readP95Ms',
        label: 'P95 de lectura (ms)',
        type: 'number',
        required: true,
      },
      {
        key: 'writeP95Ms',
        label: 'P95 de escritura (ms)',
        type: 'number',
        required: true,
      },
      {
        key: 'readSamples',
        label: 'Muestras de lectura',
        type: 'number',
        required: true,
      },
      {
        key: 'writeSamples',
        label: 'Muestras de escritura',
        type: 'number',
        required: true,
      },
      {
        key: 'concurrency',
        label: 'Concurrencia',
        type: 'number',
        required: true,
      },
      {
        key: 'rps',
        label: 'Peticiones por segundo',
        type: 'number',
        required: true,
      },
      {
        key: 'durationS',
        label: 'Duración (s)',
        type: 'number',
        required: true,
      },
    ],
  },
  monthly_report: {
    label: 'Reporte mensual enviado',
    startLabel: 'Enviado',
    endLabel: null,
    endRequired: false,
    fields: [
      {
        key: 'period',
        label: 'Mes reportado (AAAA-MM)',
        type: 'text',
        required: true,
      },
      { key: 'recipient', label: 'Destinatario', type: 'text' },
    ],
  },
  deployment: {
    label: 'Despliegue',
    startLabel: 'Fecha y hora',
    endLabel: null,
    endRequired: false,
    fields: [
      { key: 'version', label: 'Versión', type: 'text', required: true },
      { key: 'healthOk', label: 'Salud verificada', type: 'boolean' },
      {
        key: 'readinessOk',
        label: 'Disponibilidad verificada',
        type: 'boolean',
      },
      { key: 'functionalOk', label: 'Funciones verificadas', type: 'boolean' },
    ],
  },
};

export function slaKindLabel(kind: SlaRecordKind): string {
  return SLA_KIND_DEFS[kind].label;
}

export type SlaRecordBodyResult =
  | {
      ok: true;
      body: {
        environment: ObservabilityEnvironment;
        kind: SlaRecordKind;
        occurredAt: string;
        endedAt?: string;
        details: Record<string, unknown>;
      };
    }
  | { ok: false; error: string };

function text(values: SlaFormValues, key: string): string {
  const value = values[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Valida el formulario y arma el cuerpo del contrato (fechas en UTC). */
export function buildSlaRecordBody(
  environment: ObservabilityEnvironment,
  kind: SlaRecordKind,
  occurredAtLocal: string,
  endedAtLocal: string,
  values: SlaFormValues
): SlaRecordBodyResult {
  const def = SLA_KIND_DEFS[kind];
  const occurredAt = mexicoLocalToIso(occurredAtLocal);
  if (!occurredAt) return { ok: false, error: `Indica «${def.startLabel}».` };
  let endedAt: string | undefined;
  if (def.endLabel) {
    if (endedAtLocal) {
      const iso = mexicoLocalToIso(endedAtLocal);
      if (!iso) return { ok: false, error: `«${def.endLabel}» no es válido.` };
      endedAt = iso;
    } else if (def.endRequired) {
      return { ok: false, error: `Indica «${def.endLabel}».` };
    }
    if (endedAt && endedAt < occurredAt) {
      return {
        ok: false,
        error: `«${def.endLabel}» no puede ser anterior a «${def.startLabel}».`,
      };
    }
  }

  const details: Record<string, unknown> = {};
  for (const field of def.fields) {
    const raw = values[field.key];
    if (field.type === 'boolean') {
      details[field.key] = raw === true;
      continue;
    }
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) {
      if (field.required)
        return { ok: false, error: `Indica «${field.label}».` };
      if (field.key === 'acknowledgedAt') details[field.key] = null;
      continue;
    }
    if (field.type === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return {
          ok: false,
          error: `«${field.label}» debe ser un número mayor o igual a 0.`,
        };
      }
      details[field.key] = parsed;
    } else if (field.type === 'datetime') {
      const iso = mexicoLocalToIso(value);
      if (!iso) return { ok: false, error: `«${field.label}» no es válido.` };
      details[field.key] = iso;
    } else {
      details[field.key] = value;
    }
  }

  if (kind === 'monthly_report' && !isSlaMonth(text(values, 'period'))) {
    return {
      ok: false,
      error: 'El mes reportado debe tener el formato AAAA-MM.',
    };
  }
  return {
    ok: true,
    body: {
      environment,
      kind,
      occurredAt,
      ...(endedAt ? { endedAt } : {}),
      details,
    },
  };
}
