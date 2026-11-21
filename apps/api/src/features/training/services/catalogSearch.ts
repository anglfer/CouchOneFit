const SPANISH_TO_ENGLISH_TERMS: readonly [string, readonly string[]][] = [
  ['peso muerto rumano', ['romanian deadlift']],
  ['peso muerto sumo', ['sumo deadlift']],
  ['peso muerto', ['deadlift']],
  ['puente de gluteos', ['glute bridge', 'hip thrust']],
  ['puente de gluteo', ['glute bridge', 'hip thrust']],
  ['puente gluteo', ['glute bridge']],
  ['empuje de cadera', ['hip thrust']],
  ['sentadilla bulgara', ['bulgarian split squat', 'split squat']],
  ['sentadillas', ['squat']],
  ['sentadilla', ['squat']],
  ['zancadas', ['lunge']],
  ['zancada', ['lunge']],
  ['desplantes', ['lunge']],
  ['desplante', ['lunge']],
  ['press de banca', ['bench press']],
  ['press banca', ['bench press']],
  ['press militar', ['shoulder press', 'overhead press']],
  ['press de hombro', ['shoulder press', 'overhead press']],
  ['extension de cuadriceps', ['leg extension']],
  ['curl femoral', ['leg curl', 'hamstring']],
  ['elevaciones laterales', ['lateral raise']],
  ['elevacion lateral', ['lateral raise']],
  ['elevacion', ['raise']],
  ['patada de gluteo', ['glute kickback']],
  ['dominadas', ['pull up', 'chin up']],
  ['dominada', ['pull up', 'chin up']],
  ['jalones', ['pulldown', 'lat pulldown']],
  ['jalon', ['pulldown', 'lat pulldown']],
  ['fondos', ['dip']],
  ['flexiones', ['push up']],
  ['flexion', ['push up']],
  ['lagartijas', ['push up']],
  ['lagartija', ['push up']],
  ['plancha', ['plank']],
  ['prensa', ['leg press']],
  ['aperturas', ['fly']],
  ['apertura', ['fly']],
  ['remo', ['row']],
  ['gemelos', ['calf']],
  ['gemelo', ['calf']],
  ['pantorrillas', ['calf']],
  ['pantorrilla', ['calf']],
  ['abdominales', ['crunch', 'abs']],
  ['abdomen', ['crunch', 'abs']],
  ['isquiotibiales', ['hamstring', 'leg curl']],
  ['femorales', ['hamstring', 'leg curl']],
  ['cuadriceps', ['quad']],
  ['gluteos', ['glute']],
  ['gluteo', ['glute']],
  ['espalda', ['back']],
  ['piernas', ['leg']],
  ['pierna', ['leg']],
  ['pecho', ['chest', 'bench press']],
  ['hombros', ['shoulder']],
  ['hombro', ['shoulder']],
  ['biceps', ['biceps', 'curl']],
  ['triceps', ['triceps']],
  ['mancuernas', ['dumbbell']],
  ['mancuerna', ['dumbbell']],
  ['barra', ['barbell']],
  ['polea', ['cable']],
  ['cable', ['cable']],
  ['maquina', ['machine']],
  ['banda', ['band']],
  ['liga', ['band']],
  ['peso corporal', ['bodyweight']],
]

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

/**
 * Expands a search term into ILIKE patterns supporting Spanish exercise queries
 * against the English catalog while preserving original text matches.
 */
export function expandCatalogSearchPatterns(raw: string): string[] {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (!trimmed) return []

  const normalized = normalizeSearch(trimmed)
  const candidates = new Set<string>([trimmed.toLowerCase()])
  if (normalized) candidates.add(normalized)

  for (const [spanish, englishList] of SPANISH_TO_ENGLISH_TERMS) {
    const boundary = spanish.includes(' ')
      ? normalized.includes(spanish)
      : normalized.split(' ').includes(spanish)
    if (boundary) {
      for (const eng of englishList) candidates.add(eng)
    }
  }

  return [...candidates].slice(0, 12).map((term) => `%${escapeLike(term)}%`)
}
