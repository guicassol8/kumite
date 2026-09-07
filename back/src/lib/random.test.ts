import { describe, expect, it } from 'vitest'

import { generateOtp } from './random'

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
