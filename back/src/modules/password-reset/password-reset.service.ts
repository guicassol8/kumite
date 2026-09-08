import argon2 from 'argon2'
import { and, count, eq, gte, lt } from 'drizzle-orm'

import {
  PASSWORD_RESET_COMPLETE_MAX_PER_IP,
  PASSWORD_RESET_MAX_PER_EMAIL,
  PASSWORD_RESET_MAX_PER_IP,
  PASSWORD_RESET_WINDOW_MS,
} from '../../config'
import type { Db } from '../../db/client'
import { passwordResetOtpsTable, passwordResetRequestsTable, usersTable } from '../../db/schema'
import { generateOtp } from '../../lib/random'
import { sendPasswordResetNotice } from '../notifications/notifications.service'
import { findUserByEmail, findUserById } from '../users/users.service'

import type { CompletePasswordResetBody } from './password-reset.schema'

const OTP_TTL_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

export type PasswordResetAction = 'request' | 'complete'

export type PasswordResetAttempt = {
  action: PasswordResetAction
  emailKey: string
  ip: string
}

/**
 * Sliding-window throttle shared by both public reset routes (#142).
 *
 * Returns `true` when the attempt fits under both ceilings — and only then
 * records it. A refused attempt writes nothing, so the window always drains
 * `PASSWORD_RESET_WINDOW_MS` after the last *accepted* one; counting refusals
 * would let anyone keep an address locked out indefinitely by hammering the
 * route. Callers must answer their usual response either way: a distinct
 * "throttled" reply would hand back the account-existence oracle these routes
 * exist to deny.
 *
 * `now` is injectable for the same reason as in `acquireSubmissionSlot` (#21).
 */
export async function consumePasswordResetBudget(
  db: Db,
  attempt: PasswordResetAttempt,
  now = Date.now(),
): Promise<boolean> {
  const windowStart = new Date(now - PASSWORD_RESET_WINDOW_MS)

  // Opportunistic purge: the log is only ever read through this window, so
  // expired rows are dead weight and no separate timer has to exist.
  await db
    .delete(passwordResetRequestsTable)
    .where(lt(passwordResetRequestsTable.createdAt, windowStart))

  // No per-email ceiling on `complete`: the OTP row already caps guessing at
  // 5 attempts, and a second ceiling here would let a third party lock the
  // legitimate owner out of finishing their own reset.
  if (attempt.action === 'request') {
    const [perEmail] = await db
      .select({ value: count() })
      .from(passwordResetRequestsTable)
      .where(
        and(
          eq(passwordResetRequestsTable.action, attempt.action),
          eq(passwordResetRequestsTable.emailKey, attempt.emailKey),
          gte(passwordResetRequestsTable.createdAt, windowStart),
        ),
      )
    if ((perEmail?.value ?? 0) >= PASSWORD_RESET_MAX_PER_EMAIL) return false
  }

  const perIpCeiling =
    attempt.action === 'request' ? PASSWORD_RESET_MAX_PER_IP : PASSWORD_RESET_COMPLETE_MAX_PER_IP
  const [perIp] = await db
    .select({ value: count() })
    .from(passwordResetRequestsTable)
    .where(
      and(
        eq(passwordResetRequestsTable.action, attempt.action),
        eq(passwordResetRequestsTable.ip, attempt.ip),
        gte(passwordResetRequestsTable.createdAt, windowStart),
      ),
    )
  if ((perIp?.value ?? 0) >= perIpCeiling) return false

  await db.insert(passwordResetRequestsTable).values({
    action: attempt.action,
    emailKey: attempt.emailKey,
    ip: attempt.ip,
    createdAt: new Date(now),
  })
  return true
}

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

  // Deliberately not awaited: SES latency lands only on the path where an
  // account exists, which would time-leak exactly what the identical 204 is
  // there to hide. Nothing downstream depends on the send having finished.
  void sendPasswordResetNotice({ email: user.email, otp }).catch((error: unknown) => {
    console.error('[password-reset] failed to send the reset notice', error)
  })

  return { ok: true }
}

// A fixed hash to burn on the paths that issue nothing — an unknown address
// or a throttled one — so all three cost one argon2 hash. Same remedy as
// login's DUMMY_PASSWORD_HASH (auth.service.ts): without it the identical 204
// still leaks, by arriving noticeably sooner for addresses nobody registered.
const DUMMY_OTP = '000000'

// Self-service entry point for the public route: resolves the email to a user
// and issues a code. An unknown email resolves exactly like a known one —
// nothing written, nothing sent — so the endpoint is no oracle for which
// addresses are registered. A deactivated account is served like any other;
// login keeps refusing it regardless of the password. Over the throttle
// ceiling (#142) it also resolves the same way, which is the whole point:
// answering differently would put the oracle back.
export async function requestPasswordReset(
  db: Db,
  email: string,
  ip: string,
  now = Date.now(),
): Promise<void> {
  // `findUserByEmail` matches on `lower()`, so without normalising here
  // `Ada@x` and `ada@x` would count against two separate buckets and the
  // per-address ceiling would be trivially sidestepped by changing the case.
  const emailKey = email.toLowerCase()

  const withinBudget = await consumePasswordResetBudget(
    db,
    { action: 'request', emailKey, ip },
    now,
  )
  if (!withinBudget) {
    await argon2.hash(DUMMY_OTP)
    return
  }

  const user = await findUserByEmail(db, emailKey)
  if (!user) {
    await argon2.hash(DUMMY_OTP)
    return
  }

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
