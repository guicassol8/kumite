import { randomBytes } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// 24 chars, alphanumeric-only: clears SignupBodySchema's password.min(8) with
// room to spare, and avoids symbols that could complicate copy/paste from logs.
export function generateTemporaryPassword(): string {
  const bytes = randomBytes(24)
  let password = ''
  for (const byte of bytes) {
    password += ALPHABET[byte % ALPHABET.length]
  }
  return password
}
