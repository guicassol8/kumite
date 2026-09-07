import { randomBytes } from 'node:crypto'

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

// Generates and emails a 6-digit OTP, and immediately invalidates the old
// password (an unusable random hash — not the OTP itself) so the account is
// locked out until the OTP is completed. A second call for the same user
// replaces any pending OTP.
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

  const unusableHash = await argon2.hash(randomBytes(32).toString('hex'))
  await db
    .update(usersTable)
    .set({ passwordHash: unusableHash, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))

  await sendPasswordResetNotice({ email: user.email, otp })

  return { ok: true }
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
