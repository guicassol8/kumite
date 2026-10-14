import argon2 from 'argon2'

export function argon2Hash(plain: string): Promise<string> {
  return argon2.hash(plain)
}

export function argon2Verify(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain)
}
