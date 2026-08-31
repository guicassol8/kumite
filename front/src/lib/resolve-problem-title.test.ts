import { describe, expect, it } from 'vitest'

import { resolveProblemTitle } from './resolve-problem-title'

describe('resolveProblemTitle', () => {
  it('returns the title matching the UI locale', () => {
    const translations = [
      { locale: 'pt' as const, title: 'Soma de dois números' },
      { locale: 'es' as const, title: 'Suma de dos números' },
    ]

    expect(resolveProblemTitle(translations, 'es')).toBe('Suma de dos números')
  })

  it('falls back to the pt title when the UI locale has no translation', () => {
    const translations = [{ locale: 'pt' as const, title: 'Soma de dois números' }]

    expect(resolveProblemTitle(translations, 'en')).toBe('Soma de dois números')
  })

  it('returns undefined when there are no translations at all', () => {
    expect(resolveProblemTitle([], 'en')).toBeUndefined()
  })
})
