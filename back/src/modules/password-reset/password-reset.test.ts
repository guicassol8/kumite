import argon2 from 'argon2'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  PASSWORD_RESET_COMPLETE_MAX_PER_IP,
  PASSWORD_RESET_MAX_PER_EMAIL,
  PASSWORD_RESET_MAX_PER_IP,
  PASSWORD_RESET_WINDOW_MS,
} from '../../config'
import { createDb } from '../../db/client'
import { passwordResetOtpsTable, passwordResetRequestsTable, usersTable } from '../../db/schema'
import { findUserById } from '../users/users.service'

import {
  completePasswordReset,
  consumePasswordResetBudget,
  issuePasswordResetOtp,
  requestPasswordReset,
} from './password-reset.service'

const sendPasswordResetNotice = vi.fn().mockResolvedValue(undefined)
vi.mock('../notifications/notifications.service', () => ({
  sendPasswordResetNotice: (notice: unknown) => sendPasswordResetNotice(notice),
}))

// Runs against the real dockerized Postgres (docker compose up -d) — the #52
// migrations must already be applied.
const db = createDb()

beforeEach(async () => {
  sendPasswordResetNotice.mockClear()
  await db.execute(sql`truncate table ${usersTable} restart identity cascade`)
  await db.execute(sql`truncate table ${passwordResetRequestsTable}`)
})

afterAll(async () => {
  await db.$client.end()
})

async function createTestUser(email = 'ada@example.com') {
  const passwordHash = await argon2.hash('original-password')
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash, role: 'participant', university: 'pucrs' })
    .returning()
  if (!user) throw new Error('expected user to be created')
  return user
}

function lastOtp(): string {
  const call = sendPasswordResetNotice.mock.calls.at(-1) as [{ otp: string }] | undefined
  const otp = call?.[0]?.otp
  if (!otp) throw new Error('expected sendPasswordResetNotice to have been called')
  return otp
}

describe('issuePasswordResetOtp', () => {
  it('keeps the current password usable until the reset completes', async () => {
    const user = await createTestUser()
    await issuePasswordResetOtp(db, user.id)

    const updated = await findUserById(db, user.id)
    const stillValid = await argon2.verify(updated?.passwordHash ?? '', 'original-password')
    expect(stillValid).toBe(true)
  })

  it('sends the OTP by email', async () => {
    const user = await createTestUser()
    await issuePasswordResetOtp(db, user.id)

    expect(sendPasswordResetNotice).toHaveBeenCalledOnce()
    const otp = lastOtp()
    expect(otp).toMatch(/^\d{6}$/)
    const [notice] = sendPasswordResetNotice.mock.calls[0] as [{ email: string }]
    expect(notice.email).toBe(user.email)
  })

  it('returns not_found for an unknown user id', async () => {
    const result = await issuePasswordResetOtp(db, '00000000-0000-0000-0000-000000000000')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })
})

describe('consumePasswordResetBudget', () => {
  const ip = '203.0.113.9'

  it('accepts up to the per-email ceiling and refuses the next one', async () => {
    const now = Date.now()
    for (let i = 0; i < PASSWORD_RESET_MAX_PER_EMAIL; i++) {
      const accepted = await consumePasswordResetBudget(
        db,
        { action: 'request', emailKey: 'ada@example.com', ip },
        now,
      )
      expect(accepted).toBe(true)
    }

    const overCeiling = await consumePasswordResetBudget(
      db,
      { action: 'request', emailKey: 'ada@example.com', ip },
      now,
    )
    expect(overCeiling).toBe(false)
  })

  it('does not count a refused attempt, so the window drains from the last accepted one', async () => {
    const now = Date.now()
    for (let i = 0; i < PASSWORD_RESET_MAX_PER_EMAIL; i++) {
      await consumePasswordResetBudget(
        db,
        { action: 'request', emailKey: 'ada@example.com', ip },
        now,
      )
    }

    // Refused ten minutes in: it must leave no trace, or hammering the route
    // would keep pushing the window forward and lock the address out for good.
    await consumePasswordResetBudget(
      db,
      { action: 'request', emailKey: 'ada@example.com', ip },
      now + 10 * 60 * 1000,
    )
    const rows = await db.select().from(passwordResetRequestsTable)
    expect(rows).toHaveLength(PASSWORD_RESET_MAX_PER_EMAIL)

    const afterWindow = await consumePasswordResetBudget(
      db,
      { action: 'request', emailKey: 'ada@example.com', ip },
      now + PASSWORD_RESET_WINDOW_MS + 1,
    )
    expect(afterWindow).toBe(true)
  })

  it('trips the per-IP ceiling even when every email is different', async () => {
    const now = Date.now()
    for (let i = 0; i < PASSWORD_RESET_MAX_PER_IP; i++) {
      const accepted = await consumePasswordResetBudget(
        db,
        { action: 'request', emailKey: `sweep-${i}@example.com`, ip },
        now,
      )
      expect(accepted).toBe(true)
    }

    const overCeiling = await consumePasswordResetBudget(
      db,
      { action: 'request', emailKey: 'one-more@example.com', ip },
      now,
    )
    expect(overCeiling).toBe(false)

    // Another client is unaffected — the ceiling is per IP, not global.
    const otherClient = await consumePasswordResetBudget(
      db,
      { action: 'request', emailKey: 'one-more@example.com', ip: '198.51.100.7' },
      now,
    )
    expect(otherClient).toBe(true)
  })

  it('keeps the request and complete buckets separate', async () => {
    const now = Date.now()
    for (let i = 0; i < PASSWORD_RESET_MAX_PER_EMAIL; i++) {
      await consumePasswordResetBudget(
        db,
        { action: 'request', emailKey: 'ada@example.com', ip },
        now,
      )
    }
    expect(
      await consumePasswordResetBudget(
        db,
        { action: 'request', emailKey: 'ada@example.com', ip },
        now,
      ),
    ).toBe(false)

    expect(
      await consumePasswordResetBudget(
        db,
        { action: 'complete', emailKey: 'ada@example.com', ip },
        now,
      ),
    ).toBe(true)
  })

  it('has its own, higher per-IP ceiling on complete — and no per-email one', async () => {
    const now = Date.now()
    for (let i = 0; i < PASSWORD_RESET_COMPLETE_MAX_PER_IP; i++) {
      const accepted = await consumePasswordResetBudget(
        db,
        { action: 'complete', emailKey: 'ada@example.com', ip },
        now,
      )
      expect(accepted).toBe(true)
    }

    expect(
      await consumePasswordResetBudget(
        db,
        { action: 'complete', emailKey: 'ada@example.com', ip },
        now,
      ),
    ).toBe(false)
  })

  it('purges rows that fell out of the window', async () => {
    const now = Date.now()
    await db.insert(passwordResetRequestsTable).values({
      action: 'request',
      emailKey: 'old@example.com',
      ip,
      createdAt: new Date(now - PASSWORD_RESET_WINDOW_MS - 1),
    })

    await consumePasswordResetBudget(
      db,
      { action: 'request', emailKey: 'ada@example.com', ip },
      now,
    )

    const rows = await db.select().from(passwordResetRequestsTable)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.emailKey).toBe('ada@example.com')
  })
})

describe('requestPasswordReset', () => {
  it('issues and emails a code for a known email', async () => {
    const user = await createTestUser()

    await requestPasswordReset(db, user.email)

    expect(sendPasswordResetNotice).toHaveBeenCalledOnce()
    const pending = await db.select().from(passwordResetOtpsTable)
    expect(pending).toHaveLength(1)
    expect(pending[0]?.userId).toBe(user.id)
  })

  it('resolves silently for an unknown email — no row, no email, no oracle', async () => {
    await expect(requestPasswordReset(db, 'nobody@example.com')).resolves.toBeUndefined()

    expect(sendPasswordResetNotice).not.toHaveBeenCalled()
    const pending = await db.select().from(passwordResetOtpsTable)
    expect(pending).toHaveLength(0)
  })

  it('issues a code for a deactivated account too — login still refuses it', async () => {
    const user = await createTestUser('inactive@example.com')
    await db.update(usersTable).set({ active: false }).where(eq(usersTable.id, user.id))

    await requestPasswordReset(db, user.email)

    expect(sendPasswordResetNotice).toHaveBeenCalledOnce()
  })
})

describe('completePasswordReset', () => {
  it('sets the new password and consumes the OTP on a correct code', async () => {
    const user = await createTestUser()
    await issuePasswordResetOtp(db, user.id)
    const otp = lastOtp()

    const result = await completePasswordReset(db, {
      email: user.email,
      otp,
      newPassword: 'brand-new-password',
    })
    expect(result).toEqual({ ok: true })

    const updated = await findUserById(db, user.id)
    const valid = await argon2.verify(updated?.passwordHash ?? '', 'brand-new-password')
    expect(valid).toBe(true)

    // The old password stops working here, and only here.
    const oldStillValid = await argon2.verify(updated?.passwordHash ?? '', 'original-password')
    expect(oldStillValid).toBe(false)

    // Consumed: reusing the same OTP now fails.
    const reuse = await completePasswordReset(db, {
      email: user.email,
      otp,
      newPassword: 'another-password-1',
    })
    expect(reuse).toEqual({ ok: false, error: 'invalid_otp' })
  })

  it('rejects a wrong OTP and decrements attempts', async () => {
    const user = await createTestUser()
    await issuePasswordResetOtp(db, user.id)
    const otp = lastOtp()
    const wrongOtp = otp === '000000' ? '111111' : '000000'

    const result = await completePasswordReset(db, {
      email: user.email,
      otp: wrongOtp,
      newPassword: 'brand-new-password',
    })
    expect(result).toEqual({ ok: false, error: 'invalid_otp' })
  })

  it('locks out after 5 wrong attempts, even with the right OTP afterwards', async () => {
    const user = await createTestUser()
    await issuePasswordResetOtp(db, user.id)
    const otp = lastOtp()
    const wrongOtp = otp === '000000' ? '111111' : '000000'

    for (let i = 0; i < 5; i++) {
      await completePasswordReset(db, {
        email: user.email,
        otp: wrongOtp,
        newPassword: 'brand-new-password',
      })
    }

    const result = await completePasswordReset(db, {
      email: user.email,
      otp,
      newPassword: 'brand-new-password',
    })
    expect(result).toEqual({ ok: false, error: 'invalid_otp' })
  })

  it('rejects an expired OTP', async () => {
    const user = await createTestUser()
    await issuePasswordResetOtp(db, user.id)
    const otp = lastOtp()

    await db.execute(
      sql`update password_reset_otps set expires_at = now() - interval '1 minute' where user_id = ${user.id}`,
    )

    const result = await completePasswordReset(db, {
      email: user.email,
      otp,
      newPassword: 'brand-new-password',
    })
    expect(result).toEqual({ ok: false, error: 'invalid_otp' })
  })

  it('returns the same generic error for an unknown email — no oracle', async () => {
    const result = await completePasswordReset(db, {
      email: 'nobody@example.com',
      otp: '123456',
      newPassword: 'brand-new-password',
    })
    expect(result).toEqual({ ok: false, error: 'invalid_otp' })
  })

  it('returns the same generic error when no reset was ever issued', async () => {
    const user = await createTestUser()
    const result = await completePasswordReset(db, {
      email: user.email,
      otp: '123456',
      newPassword: 'brand-new-password',
    })
    expect(result).toEqual({ ok: false, error: 'invalid_otp' })
  })
})
