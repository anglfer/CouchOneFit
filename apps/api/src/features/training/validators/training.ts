import { AuthError } from '../../auth/types/errors.js'
import type { Prescription, SetResult, TrainingDay } from '../types/training.js'

export const invalid = (message = 'Revisa los parámetros del entrenamiento.'): never => {
  throw new AuthError(400, 'INVALID_TRAINING', message)
}
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const record = value as Record<string, unknown>
  if (Object.keys(record).some(key => !keys.includes(key))) return invalid('El formulario contiene campos no permitidos.')
  return record
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return invalid('Identificador inválido.')
  return value.toLowerCase()
}
export function text(value: unknown, maximum = 500, required = false): string {
  if (typeof value !== 'string' || value.trim().length > maximum || (required && !value.trim())) return invalid()
  return value.trim()
}
export function number(value: unknown, minimum: number, maximum: number, step = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum || Math.abs(value / step - Math.round(value / step)) > 1e-7) return invalid()
  return value
}
export function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid('Fecha inválida.')
  const parsed = new Date(`${value}T12:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return invalid('Fecha inválida.')
  return value
}
export function zone(value: unknown): string {
  const result = text(value, 80, true)
  try { new Intl.DateTimeFormat('en', { timeZone: result }).format() } catch { return invalid('Zona horaria IANA inválida.') }
  if (!result.includes('/') && result !== 'UTC') return invalid('Usa una zona IANA.')
  return result
}
// Optional numeric parameters: absent or null means "not prescribed / not reported", never zero.
export function optional(value: unknown, minimum: number, maximum: number, step = 1): number | null {
  return value === undefined || value === null ? null : number(value, minimum, maximum, step)
}
export function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return invalid()
  return value
}
export function prescription(value: unknown): Prescription {
  const input = object(value, ['name', 'schedule', 'startDate', 'days'])
  const schedule = input.schedule
  if (schedule !== 'weekly' && schedule !== 'cycle' && schedule !== 'calendar') return invalid()
  const ids = new Set<string>()
  const uniqueId = (value: unknown) => {
    const id = uuid(value)
    if (ids.has(id)) return invalid('Cada día, ejercicio y serie requiere un identificador distinto.')
    ids.add(id)
    return id
  }
  const dates = new Set<string>()
  const days = array(input.days, schedule === 'calendar' ? 366 : 28).map(value => {
    const d = object(value, ['id', 'name', 'kind', 'date', 'exercises'])
    if (d.kind !== 'training' && d.kind !== 'rest') return invalid()
    const dayDate = schedule === 'calendar' ? date(d.date) : null
    if (dayDate && dates.has(dayDate)) return invalid('Una fecha no puede tener dos días programados.')
    if (dayDate) dates.add(dayDate)
    if (schedule !== 'calendar' && d.date !== null) return invalid()
    const exercises = array(d.exercises, 40).map(value => {
      const e = object(value, ['id', 'catalogId', 'name', 'instructions', 'guidance', 'images', 'loadMode', 'restSeconds', 'sets'])
      if (e.loadMode !== 'external' && e.loadMode !== 'bodyweight') return invalid()
      const sets = array(e.sets, 20).map(value => {
        const s = object(value, ['id', 'reps', 'repsMax', 'rpe', 'rir', 'targetLoadKg'])
        const target = optional(s.targetLoadKg, e.loadMode === 'bodyweight' ? 0 : 0.1, e.loadMode === 'bodyweight' ? 0 : 1000, 0.1)
        const reps = number(s.reps, 1, 100)
        // repsMax turns the prescription into a range; equal bounds are stored as a fixed target.
        const repsMax = optional(s.repsMax, reps, 100)
        return { id: uniqueId(s.id), reps, repsMax: repsMax === reps ? null : repsMax, rpe: optional(s.rpe, 1, 10, 0.5), rir: optional(s.rir, 0, 10), targetLoadKg: target }
      })
      if (!sets.length) return invalid('Incluye al menos una serie por ejercicio.')
      const catalogId = e.catalogId === null ? null : text(e.catalogId, 150, true)
      // Catalog guidance/media are populated by the server, never trusted from a form.
      array(e.guidance, 40); array(e.images, 2)
      return { id: uniqueId(e.id), catalogId, name: text(e.name, 150, true), instructions: text(e.instructions), guidance: [] as string[], images: [] as string[], loadMode: e.loadMode, restSeconds: optional(e.restSeconds, 0, 900, 5), sets }
    })
    if ((d.kind === 'rest' && exercises.length) || (d.kind === 'training' && !exercises.length)) return invalid('El descanso no lleva ejercicios; un entrenamiento necesita al menos uno.')
    return { id: uniqueId(d.id), name: text(d.name, 100, true), kind: d.kind, date: dayDate, exercises } as TrainingDay
  })
  if (!days.length || (schedule === 'weekly' && days.length !== 7)) return invalid('La semana requiere siete días explícitos.')
  return { name: text(input.name, 150, true), schedule, startDate: date(input.startDate), days }
}
export function results(value: unknown): SetResult[] {
  const seen = new Set<string>()
  return array(value, 800).map(value => {
    const s = object(value, ['setId', 'state', 'reps', 'loadKg', 'rpe', 'rir'])
    const setId = uuid(s.setId)
    if (seen.has(setId)) return invalid('Una serie no puede aparecer dos veces.')
    seen.add(setId)
    if (s.state !== 'performed' && s.state !== 'not_performed') return invalid()
    const rpe = optional(s.rpe, 1, 10, 0.5), rir = optional(s.rir, 0, 10)
    if (s.state === 'not_performed' && (s.reps !== 0 || s.loadKg !== null || rpe !== null || rir !== null)) return invalid()
    return { setId, state: s.state, reps: number(s.reps, s.state === 'performed' ? 1 : 0, 1000), loadKg: s.loadKg === null ? null : number(s.loadKg, 0, 1000, 0.1), rpe, rir }
  })
}
