import { describe, expect, it } from 'vitest'

import { generateOtp, generateTemporaryPassword } from './random'

describe('generateOtp', () => {
  it('is always 6 digits', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateOtp()).toMatch(/^\d{6}$/)
    }
  })

  it('zero-pads values below 100000', () => {
    // Not deterministic to force a leading zero, so just assert the format
    // guarantee holds across enough samples that a short code would show up.
    const otps = Array.from({ length: 500 }, () => generateOtp())
    expect(otps.every((otp) => otp.length === 6)).toBe(true)
  })

  it('rarely collides over many calls (birthday-bound over 1e6 values)', () => {
    const otps = new Set(Array.from({ length: 500 }, () => generateOtp()))
    expect(otps.size).toBeGreaterThan(490)
  })
})

describe('generateTemporaryPassword', () => {
  it('is 3 groups of 4 unambiguous characters, hyphen separated', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTemporaryPassword()).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)
    }
  })

  it('never emits a character that is ambiguous when read out loud', () => {
    // The organizer dictates this password across a desk, so 0/o, 1/l/i must
    // not be in the alphabet at all — otherwise half of them come back
    // mistyped and the "temporary password" is a support call.
    for (let i = 0; i < 1000; i++) {
      expect(generateTemporaryPassword()).not.toMatch(/[01oli]/)
    }
  })

  it('does not repeat over many calls', () => {
    const passwords = new Set(Array.from({ length: 1000 }, () => generateTemporaryPassword()))
    expect(passwords.size).toBe(1000)
  })
})
