import assert from 'node:assert/strict'
import { test } from 'node:test'
import { expandCatalogSearchPatterns } from '../src/features/training/services/catalogSearch.js'

test('expandCatalogSearchPatterns handles empty strings, English queries and Spanish equivalents', () => {
  assert.deepEqual(expandCatalogSearchPatterns(''), [])
  assert.deepEqual(expandCatalogSearchPatterns('   '), [])

  const rdl = expandCatalogSearchPatterns('Peso muerto rumano')
  assert.ok(rdl.includes('%romanian deadlift%'))

  const lunge = expandCatalogSearchPatterns('Zancada estática')
  assert.ok(lunge.includes('%lunge%'))

  const bridge = expandCatalogSearchPatterns('Puente de glúteos')
  assert.ok(bridge.includes('%glute bridge%'))
  assert.ok(bridge.includes('%hip thrust%'))

  const english = expandCatalogSearchPatterns('  Bench Press ')
  assert.ok(english.includes('%bench press%'))
  assert.ok(english.length <= 12)
})
