import { describe, expect, it } from 'vitest'

import { generateTemporaryPassword } from './random'

describe('generateTemporaryPassword', () => {
  it('is long enough to clear the min(8) password requirement with room to spare', () => {
    const password = generateTemporaryPassword()
    expect(password.length).toBeGreaterThanOrEqual(16)
  })

  it('only uses alphanumeric characters', () => {
    const password = generateTemporaryPassword()
    expect(password).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('does not collide over many calls', () => {
    const passwords = new Set(Array.from({ length: 1000 }, () => generateTemporaryPassword()))
    expect(passwords.size).toBe(1000)
  })
})
