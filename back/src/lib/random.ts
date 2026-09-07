import { randomInt } from 'node:crypto'

// 6-digit numeric OTP, zero-padded — used for the password-reset
// confirmation flow (back/src/modules/password-reset).
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}
