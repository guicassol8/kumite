import { signJwt } from '@katajs-framework/core/jwt'
import argon2 from 'argon2'
import { eq } from 'drizzle-orm'

import { JWT_SECRET, TOKEN_TTL_SECONDS } from '../../config'
import type { Db } from '../../db/client'
import { passwordResetOtpsTable, usersTable } from '../../db/schema'
import { findEventCode } from '../event-codes/event-codes.service'
import type { PublicUser } from '../users/users.schema'
import { createUser, findUserByEmail, findUserById } from '../users/users.service'

import type { ChangePasswordBody, LoginBody, SignupBody } from './auth.schema'

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
    // Already trimmed by SignupBodySchema.
    name: input.name,
    passwordHash,
    role: 'participant',
    university: eventCode.university,
  })
  if (!user) return { ok: false, error: 'signup_failed' }

  const { passwordHash: _passwordHash, ...publicUser } = user
  return { ok: true, user: publicUser }
}

export type LoginResult = { ok: true; token: string } | { ok: false; error: 'invalid_credentials' }

// A fixed hash to verify against when no user was found — keeps an unknown
// email and a wrong password indistinguishable in timing, not just message.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$j6yGseerX6DfaU27x8lDDw$e1Fe6AQFidtNEGb3A9U9coyLjd/QnVBIPaNWvwwkSI4'

export async function login(db: Db, input: LoginBody): Promise<LoginResult> {
  const user = await findUserByEmail(db, input.email)
  const valid = await argon2.verify(user?.passwordHash ?? DUMMY_PASSWORD_HASH, input.password)
  if (!user || !valid || !user.active) return { ok: false, error: 'invalid_credentials' }

  const token = await signJwt(
    { role: user.role, university: user.university },
    { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
  )
  return { ok: true, token }
}

export type ChangePasswordResult = { ok: true } | { ok: false; error: 'invalid_credentials' }

/**
 * Self-service password change for an already-authenticated user (#143).
 *
 * It is both the way out of the forced-change state an organizer reset puts an
 * account in and an ordinary "change my password" — same function, same rules.
 * The current password is always required, forced flow included: otherwise a
 * lab machine left logged in would be enough to take the account over
 * permanently, which is the very thing the reset flow is trying to prevent.
 *
 * Clearing `mustChangePassword` is what lifts the `requirePasswordUpToDate`
 * block, and a pending OTP is dropped so a code issued before the change
 * cannot be redeemed afterwards to overwrite the password just chosen.
 */
export async function changePassword(
  db: Db,
  userId: string,
  input: ChangePasswordBody,
): Promise<ChangePasswordResult> {
  const user = await findUserById(db, userId)
  const valid = await argon2.verify(
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    input.currentPassword,
  )
  if (!user || !valid) return { ok: false, error: 'invalid_credentials' }

  const passwordHash = await argon2.hash(input.newPassword)
  await db
    .update(usersTable)
    .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
  await db.delete(passwordResetOtpsTable).where(eq(passwordResetOtpsTable.userId, user.id))

  return { ok: true }
}
