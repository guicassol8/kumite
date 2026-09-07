import argon2 from 'argon2'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDb } from '../../db/client'
import { usersTable } from '../../db/schema'
import { findUserById } from '../users/users.service'

import { completePasswordReset, issuePasswordResetOtp } from './password-reset.service'

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
  it('invalidates the old password immediately', async () => {
    const user = await createTestUser()
    await issuePasswordResetOtp(db, user.id)

    const updated = await findUserById(db, user.id)
    const stillValid = await argon2.verify(updated?.passwordHash ?? '', 'original-password')
    expect(stillValid).toBe(false)
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
