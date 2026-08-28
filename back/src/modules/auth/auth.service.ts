import argon2 from 'argon2'

import type { Db } from '../../db/client'
import { findEventCode } from '../event-codes/event-codes.service'
import type { PublicUser } from '../users/users.schema'
import { createUser } from '../users/users.service'

import type { SignupBody } from './auth.schema'

export type SignupResult =
  | { ok: true; user: PublicUser }
  | { ok: false; error: 'invalid_event_code' }
  | { ok: false; error: 'invalid_email_domain'; allowedSuffixes: string[] }
  | { ok: false; error: 'signup_failed' }

// A naive `email.endsWith(suffix)` would let attacker@evilpucrs.br pass a
// pucrs.br suffix — compare the email's domain instead, exact or a proper
// subdomain of the suffix.
function domainMatchesSuffix(domain: string, suffix: string): boolean {
  return domain === suffix || domain.endsWith(`.${suffix}`)
}

export async function signup(db: Db, input: SignupBody): Promise<SignupResult> {
  const eventCode = await findEventCode(db, input.code)
  if (!eventCode || !eventCode.active) return { ok: false, error: 'invalid_event_code' }

  const domain = input.email.split('@')[1]?.toLowerCase() ?? ''
  const allowedSuffixes = eventCode.allowedEmailSuffixes
  if (!allowedSuffixes.some((suffix) => domainMatchesSuffix(domain, suffix))) {
    return { ok: false, error: 'invalid_email_domain', allowedSuffixes }
  }

  const passwordHash = await argon2.hash(input.password)
  const user = await createUser(db, {
    email: input.email.toLowerCase(),
    passwordHash,
    role: 'participant',
    university: eventCode.university,
  })
  if (!user) return { ok: false, error: 'signup_failed' }

  const { passwordHash: _passwordHash, ...publicUser } = user
  return { ok: true, user: publicUser }
}
