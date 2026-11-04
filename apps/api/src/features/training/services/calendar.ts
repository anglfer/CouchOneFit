import type { Prescription, TrainingDay } from '../types/training.js'

export function localDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export const calendarDistance = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000)
export function scheduledDay(plan: Prescription, date: string): TrainingDay | null {
  const elapsed = calendarDistance(date, plan.startDate)
  if (elapsed < 0) return null
  if (plan.schedule === 'calendar') return plan.days.find(day => day.date === date) ?? null
  const index = plan.schedule === 'cycle' ? elapsed % plan.days.length : (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
  return plan.days[index] ?? null
}
