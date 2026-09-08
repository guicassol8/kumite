import { randomInt } from 'node:crypto'

// 6-digit numeric OTP, zero-padded — used for the password-reset
// confirmation flow (back/src/modules/password-reset).
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

// No `0 o 1 l i` — this password is read out loud by an organizer to a
// participant standing in front of them (#143), so every character has to
// survive being dictated. 31 symbols over 12 characters is ~59 bits, plenty
// for a credential that only lives until the forced change at next login.
const TEMPORARY_PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const TEMPORARY_PASSWORD_GROUPS = 3
const TEMPORARY_PASSWORD_GROUP_SIZE = 4

// 12 characters as three hyphen-separated groups of four (`k7fq-3nrv-9wzt`),
// grouped for the same reason the alphabet is trimmed: it has to be dictated.
// `randomInt` is crypto-backed and rejection-samples, so there is no modulo
// bias towards the front of the alphabet.
export function generateTemporaryPassword(): string {
  const groups = Array.from({ length: TEMPORARY_PASSWORD_GROUPS }, () =>
    Array.from(
      { length: TEMPORARY_PASSWORD_GROUP_SIZE },
      () => TEMPORARY_PASSWORD_ALPHABET[randomInt(0, TEMPORARY_PASSWORD_ALPHABET.length)],
    ).join(''),
  )
  return groups.join('-')
}
