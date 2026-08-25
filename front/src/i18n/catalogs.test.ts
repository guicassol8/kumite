import { describe, expect, it } from 'vitest'

import en from './en.json'
import es from './es.json'
import pt from './pt.json'

function keysOf(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? keysOf(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

// Guards the tri-lingual contract: adding a string to one catalog without the
// other two fails the suite (and therefore the Stop hook and pre-commit).
describe('i18n catalogs', () => {
  it('pt, es and en expose exactly the same keys', () => {
    const reference = keysOf(pt).sort()
    expect(keysOf(es).sort()).toEqual(reference)
    expect(keysOf(en).sort()).toEqual(reference)
  })
})
