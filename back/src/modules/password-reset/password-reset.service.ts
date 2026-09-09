import argon2 from 'argon2'
import { and, count, eq, gte, lt, sql } from 'drizzle-orm'

import {
  PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER,
  PASSWORD_RESET_COMPLETE_MAX_PER_IP,
  PASSWORD_RESET_MAX_PER_EMAIL,
  PASSWORD_RESET_MAX_PER_IP,
  PASSWORD_RESET_WINDOW_MS,
} from '../../config'
import type { Db } from '../../db/client'
import { passwordResetOtpsTable, passwordResetRequestsTable, usersTable } from '../../db/schema'
import { generateOtp, generateTemporaryPassword } from '../../lib/random'
import { sendPasswordResetNotice } from '../notifications/notifications.service'
import { findUserByEmail, findUserById } from '../users/users.service'

import type { CompletePasswordResetBody } from './password-reset.schema'

const OTP_TTL_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

export type PasswordResetAction = 'request' | 'complete' | 'organizer_reset'

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
 * Counting and inserting are one critical section, held by a transaction-scoped
 * advisory lock per bucket. Without it every call of a parallel burst reads the
 * same count before any of them has inserted, and the ceiling is bypassed by
 * simply firing the requests at once instead of in sequence — measured on this
 * route at 10 codes issued and 10 notices sent against a ceiling of 3.
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
  // expired rows are dead weight and no separate timer has to exist. Kept
  // outside the critical section below — the counts filter on `windowStart`
  // themselves, so this only reclaims space, and it scans rows of every bucket
  // rather than just this one's.
  await db
    .delete(passwordResetRequestsTable)
    .where(lt(passwordResetRequestsTable.createdAt, windowStart))

  return db.transaction(async (tx) => {
    // Advisory, transaction-scoped: released on commit, and only ever
    // serialises callers aimed at the same address or the same IP. `request`
    // takes the address lock before the IP one and `complete` takes only the
    // IP one, so two waiters can never cycle into a deadlock.
    if (attempt.action === 'request') {
      const emailLock = `pwr-email:${attempt.action}:${attempt.emailKey}`
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${emailLock}::text))`)
    }
    const ipLock = `pwr-ip:${attempt.action}:${attempt.ip}`
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ipLock}::text))`)

    // No per-email ceiling on `complete`: the OTP row already caps guessing at
    // 5 attempts, and a second ceiling here would let a third party lock the
    // legitimate owner out of finishing their own reset.
    if (attempt.action === 'request') {
      const [perEmail] = await tx
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
    const [perIp] = await tx
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

    await tx.insert(passwordResetRequestsTable).values({
      action: attempt.action,
      emailKey: attempt.emailKey,
      ip: attempt.ip,
      createdAt: new Date(now),
    })
    return true
  })
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

// A hash of a code that was never issued, verified against whenever there is
// no usable pending OTP — the counterpart of DUMMY_OTP above, so that every
// failing path costs one argon2.verify instead of returning early.
const DUMMY_OTP_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$j40eFEQ4Zb1nEazULxlbmw$TtwMiaH2QjZJ24iYuib+5MY0uA918lLDiv/1pFOUI38'

// Unknown email, no pending OTP, an expired one, an exhausted one and a
// throttled caller all return the identical `invalid_otp` shape — no oracle,
// mirrors login's non-oracle design (auth.service.ts).
export async function completePasswordReset(
  db: Db,
  input: CompletePasswordResetBody,
  ip: string,
  now = Date.now(),
): Promise<CompletePasswordResetResult> {
  const emailKey = input.email.toLowerCase()

  // Checked before the OTP row is even read: a throttled call must cost the
  // legitimate owner nothing, least of all one of their 5 attempts.
  const withinBudget = await consumePasswordResetBudget(
    db,
    { action: 'complete', emailKey, ip },
    now,
  )
  if (!withinBudget) {
    await argon2.verify(DUMMY_OTP_HASH, input.otp)
    return { ok: false, error: 'invalid_otp' }
  }

  const user = await findUserByEmail(db, emailKey)
  const [pending] = user
    ? await db
        .select()
        .from(passwordResetOtpsTable)
        .where(eq(passwordResetOtpsTable.userId, user.id))
    : []

  // One verify on every path, against the real hash when there is one and the
  // dummy otherwise — an unknown address must not answer faster than a wrong
  // code for a real one.
  const usable = pending !== undefined && pending.expiresAt.getTime() >= now
  const valid = await argon2.verify(usable ? pending.otpHash : DUMMY_OTP_HASH, input.otp)
  if (!user || !usable) return { ok: false, error: 'invalid_otp' }

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

// --- Organizer-driven reset (#143) ---

// Burned when the step-up is refused before the real hash is ever consulted,
// so the throttled path costs the same argon2.verify as a merely wrong
// password. The spec asks for "the same 403, no distinction" — and answering
// several hundred milliseconds sooner is a distinction, one that tells an
// attacker exactly when to back off and come back after the window.
const DUMMY_ADMIN_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$PGqDaii+IbTUz1dqPWYhoA$TB1dtm8qwEDANaCU8mwyeZvTLHEBuGymYZ35z+gLYOI'

export type StepUpResult = { ok: true } | { ok: false; error: 'invalid_admin_password' }

export type OrganizerStepUp = {
  organizerId: string
  passwordHash: string
  password: string
  ip: string
}

/**
 * Re-authenticates the acting organizer before a destructive action, with a
 * ceiling of its own (#143).
 *
 * The route it protects takes over a participant's account, so a session
 * cookie alone must not be enough — the organizer types their own password
 * again. That in turn makes the route a brute-force oracle against that
 * password, hence the ceiling: at most
 * `PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER` failures per organizer inside
 * `PASSWORD_RESET_WINDOW_MS`.
 *
 * Only failures are counted and a correct password clears them, so an
 * organizer who fat-fingers their password twice and then gets it right walks
 * away with a clean window — the ceiling exists for someone guessing, not for
 * someone typing. The bucket is keyed by organizer id rather than IP: the
 * caller is already authenticated, so the account is the thing worth
 * protecting, and every organizer at the event shares one venue NAT anyway.
 *
 * Reuses `password_reset_requests` under the `organizer_reset` action, where
 * `email_key` holds the organizer's id (see db/schema.ts and ADR-0004), and
 * the same advisory-lock discipline as `consumePasswordResetBudget`: counting
 * and inserting are one critical section, or a parallel burst walks straight
 * past the ceiling.
 */
export async function verifyOrganizerStepUp(
  db: Db,
  input: OrganizerStepUp,
  now = Date.now(),
): Promise<StepUpResult> {
  const windowStart = new Date(now - PASSWORD_RESET_WINDOW_MS)

  // Opportunistic purge, outside the critical section — same rationale as in
  // `consumePasswordResetBudget`: the counts filter on `windowStart` anyway,
  // so this only reclaims space.
  await db
    .delete(passwordResetRequestsTable)
    .where(lt(passwordResetRequestsTable.createdAt, windowStart))

  return db.transaction(async (tx) => {
    const lockKey = `pwr-admin:${input.organizerId}`
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}::text))`)

    const [failures] = await tx
      .select({ value: count() })
      .from(passwordResetRequestsTable)
      .where(
        and(
          eq(passwordResetRequestsTable.action, 'organizer_reset'),
          eq(passwordResetRequestsTable.emailKey, input.organizerId),
          gte(passwordResetRequestsTable.createdAt, windowStart),
        ),
      )

    if ((failures?.value ?? 0) >= PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER) {
      await argon2.verify(DUMMY_ADMIN_PASSWORD_HASH, input.password)
      return { ok: false, error: 'invalid_admin_password' }
    }

    if (!(await argon2.verify(input.passwordHash, input.password))) {
      await tx.insert(passwordResetRequestsTable).values({
        action: 'organizer_reset',
        emailKey: input.organizerId,
        ip: input.ip,
        createdAt: new Date(now),
      })
      return { ok: false, error: 'invalid_admin_password' }
    }

    await tx
      .delete(passwordResetRequestsTable)
      .where(
        and(
          eq(passwordResetRequestsTable.action, 'organizer_reset'),
          eq(passwordResetRequestsTable.emailKey, input.organizerId),
        ),
      )
    return { ok: true }
  })
}

export type OrganizerResetResult =
  | { ok: true; temporaryPassword: string }
  | { ok: false; error: 'invalid_admin_password' | 'target_not_participant' | 'not_found' }

export type OrganizerResetInput = {
  organizerId: string
  targetId: string
  adminPassword: string
  ip: string
}

/**
 * The manual valve for the one case no self-service flow covers: a participant
 * standing at the desk who cannot reach their inbox (#143). The organizer
 * confirms with their own password, gets a temporary password back exactly
 * once, and dictates it; the account is flagged so the participant has to
 * choose a real one before doing anything else.
 *
 * Order matters. The step-up runs *before* the target is looked at, so a
 * hijacked organizer session cannot use the route as an existence probe while
 * still guessing the password. Only participants are valid targets, and never
 * the caller themselves: a compromised organizer account must not be a lever
 * for taking over the other organizers.
 *
 * Nothing is e-mailed — the whole premise is that the participant has no
 * access to their mailbox — and any OTP they had pending is dropped, so a code
 * issued before the reset cannot be used to overwrite the new password after.
 */
export async function resetPasswordByOrganizer(
  db: Db,
  input: OrganizerResetInput,
  now = Date.now(),
): Promise<OrganizerResetResult> {
  // `currentUser` is a PublicUser and carries no hash, so the acting organizer
  // is re-read here rather than passed down from the route.
  const organizer = await findUserById(db, input.organizerId)
  if (!organizer) return { ok: false, error: 'invalid_admin_password' }

  const stepUp = await verifyOrganizerStepUp(
    db,
    {
      organizerId: organizer.id,
      passwordHash: organizer.passwordHash,
      password: input.adminPassword,
      ip: input.ip,
    },
    now,
  )
  if (!stepUp.ok) return { ok: false, error: 'invalid_admin_password' }

  if (input.targetId === organizer.id) return { ok: false, error: 'target_not_participant' }

  const target = await findUserById(db, input.targetId)
  if (!target) return { ok: false, error: 'not_found' }
  if (target.role !== 'participant') return { ok: false, error: 'target_not_participant' }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await argon2.hash(temporaryPassword)
  await db
    .update(usersTable)
    .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
    .where(eq(usersTable.id, target.id))
  await db.delete(passwordResetOtpsTable).where(eq(passwordResetOtpsTable.userId, target.id))

  return { ok: true, temporaryPassword }
}
