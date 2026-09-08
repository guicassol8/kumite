import argon2 from 'argon2'
import { eq } from 'drizzle-orm'

import type { Db } from '../../db/client'
import { passwordResetOtpsTable, usersTable } from '../../db/schema'
import { generateOtp } from '../../lib/random'
import { sendPasswordResetNotice } from '../notifications/notifications.service'
import { findUserByEmail, findUserById } from '../users/users.service'

import type { CompletePasswordResetBody } from './password-reset.schema'

const OTP_TTL_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

export type IssueOtpResult = { ok: true } | { ok: false; error: 'not_found' }

// Generates and emails a 6-digit OTP. The current password stays usable until
// `completePasswordReset` succeeds — issuing must not lock anyone out, since
// `/auth/request-password-reset` is public and takes nothing but an email.
// A second call for the same user replaces any pending OTP.
export async function issuePasswordResetOtp(db: Db, userId: string): Promise<IssueOtpResult> {
  const user = await findUserById(db, userId)
  if (!user) return { ok: false, error: 'not_found' }

  const otp = generateOtp()
  const otpHash = await argon2.hash(otp)
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)

  await db
    .insert(passwordResetOtpsTable)
    .values({ userId, otpHash, expiresAt, attemptsRemaining: MAX_ATTEMPTS })
    .onConflictDoUpdate({
      target: passwordResetOtpsTable.userId,
      set: { otpHash, expiresAt, attemptsRemaining: MAX_ATTEMPTS, createdAt: new Date() },
    })

  await sendPasswordResetNotice({ email: user.email, otp })

  return { ok: true }
}

// Self-service entry point for the public route: resolves the email to a user
// and issues a code. An unknown email resolves exactly like a known one —
// nothing written, nothing sent — so the endpoint is no oracle for which
// addresses are registered. A deactivated account is served like any other;
// login keeps refusing it regardless of the password.
export async function requestPasswordReset(db: Db, email: string): Promise<void> {
  const user = await findUserByEmail(db, email)
  if (!user) return

  await issuePasswordResetOtp(db, user.id)
}

export type CompletePasswordResetResult = { ok: true } | { ok: false; error: 'invalid_otp' }

// Unknown email, no pending OTP, an expired one, and an exhausted one all
// return the identical `invalid_otp` shape — no oracle, mirrors login's
// non-oracle design (auth.service.ts).
export async function completePasswordReset(
  db: Db,
  input: CompletePasswordResetBody,
): Promise<CompletePasswordResetResult> {
  const user = await findUserByEmail(db, input.email)
  if (!user) return { ok: false, error: 'invalid_otp' }

  const [pending] = await db
    .select()
    .from(passwordResetOtpsTable)
    .where(eq(passwordResetOtpsTable.userId, user.id))
  if (!pending || pending.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'invalid_otp' }
  }

  const valid = await argon2.verify(pending.otpHash, input.otp)
  if (!valid) {
    const remaining = pending.attemptsRemaining - 1
    if (remaining <= 0) {
      await db.delete(passwordResetOtpsTable).where(eq(passwordResetOtpsTable.userId, user.id))
    } else {
      await db
        .update(passwordResetOtpsTable)
        .set({ attemptsRemaining: remaining })
        .where(eq(passwordResetOtpsTable.userId, user.id))
    }
    return { ok: false, error: 'invalid_otp' }
  }

  const passwordHash = await argon2.hash(input.newPassword)
  await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
  await db.delete(passwordResetOtpsTable).where(eq(passwordResetOtpsTable.userId, user.id))

  return { ok: true }
}
