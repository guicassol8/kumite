import { describe, expect, it } from 'vitest'

import { passwordResetEmailCopy } from './notifications.service'

describe('passwordResetEmailCopy (#231)', () => {
  const [pt, es, en] = [
    passwordResetEmailCopy.pt,
    passwordResetEmailCopy.es,
    passwordResetEmailCopy.en,
  ]

  it('carries the exact same keys in all three locales', () => {
    const keys = Object.keys(pt).sort()
    expect(Object.keys(es).sort()).toEqual(keys)
    expect(Object.keys(en).sort()).toEqual(keys)
  })

  it('has no empty string anywhere', () => {
    for (const copy of [pt, es, en]) {
      for (const value of Object.values(copy)) {
        expect(value.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('always spells the product name lowercase', () => {
    for (const copy of [pt, es, en]) {
      expect(copy.subject).toContain('kumite')
      expect(copy.subject).not.toMatch(/Kumite/)
    }
  })
})
