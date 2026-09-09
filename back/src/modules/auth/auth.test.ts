import { verifyJwt } from '@katajs-framework/core/jwt'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { JWT_SECRET } from '../../config'
import { createDb } from '../../db/client'
import { eventCodesTable, passwordResetOtpsTable, usersTable } from '../../db/schema'
import { issuePasswordResetOtp } from '../password-reset/password-reset.service'
import { UserClaimsSchema } from '../users/users.schema'
import { findUserById } from '../users/users.service'

import { ChangePasswordBodySchema, LoginBodySchema, SignupBodySchema } from './auth.schema'
import { changePassword, login, signup } from './auth.service'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #24 migration must already be applied.
const db = createDb()

beforeEach(async () => {
  await db.execute(sql`truncate table ${usersTable}, ${eventCodesTable} restart identity cascade`)
  await db.insert(eventCodesTable).values([
    { code: 'PUCRS2026', university: 'pucrs', allowedEmailSuffixes: ['edu.pucrs.br', 'pucrs.br'] },
    {
      code: 'INACTIVE2026',
      university: 'pucrs',
      allowedEmailSuffixes: ['pucrs.br'],
      active: false,
    },
  ])
})

afterAll(async () => {
  await db.$client.end()
})

describe('SignupBodySchema', () => {
  it('rejects a password under 8 characters', () => {
    const result = SignupBodySchema.safeParse({
      email: 'ada@pucrs.br',
      password: 'short1',
      code: 'PUCRS2026',
    })
    expect(result.success).toBe(false)
  })
})

describe('LoginBodySchema', () => {
  it('rejects an empty password', () => {
    const result = LoginBodySchema.safeParse({ email: 'ada@pucrs.br', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('auth.service signup', () => {
  it('creates a participant in the university from a valid code and matching domain', async () => {
    const result = await signup(db, {
      email: 'ada@edu.pucrs.br',
      password: 'supersecret',
      code: 'PUCRS2026',
    })

    if (!result.ok) throw new Error('expected ok')
    expect(result.user.role).toBe('participant')
    expect(result.user.university).toBe('pucrs')
    expect(result.user).not.toHaveProperty('passwordHash')
  })

  it('rejects an unknown code without revealing valid codes', async () => {
    const result = await signup(db, {
      email: 'ada@edu.pucrs.br',
      password: 'supersecret',
      code: 'DOES-NOT-EXIST',
    })

    expect(result).toEqual({ ok: false, error: 'invalid_event_code' })
  })

  it('rejects an inactive code the same way as an unknown one', async () => {
    const result = await signup(db, {
      email: 'ada@pucrs.br',
      password: 'supersecret',
      code: 'INACTIVE2026',
    })

    expect(result).toEqual({ ok: false, error: 'invalid_event_code' })
  })

  it('rejects a domain outside the code university allowed suffixes', async () => {
    const result = await signup(db, {
      email: 'ada@merida.edu.mx',
      password: 'supersecret',
      code: 'PUCRS2026',
    })

    if (result.ok) throw new Error('expected rejection')
    expect(result.error).toBe('invalid_email_domain')
    expect(result).toMatchObject({ allowedSuffixes: ['edu.pucrs.br', 'pucrs.br'] })
  })

  it('rejects a domain that merely contains the suffix as a substring', async () => {
    const result = await signup(db, {
      email: 'ada@evilpucrs.br',
      password: 'supersecret',
      code: 'PUCRS2026',
    })

    expect(result).toMatchObject({ ok: false, error: 'invalid_email_domain' })
  })

  it('rejects a duplicate email that only differs by case', async () => {
    await signup(db, { email: 'ada@edu.pucrs.br', password: 'supersecret', code: 'PUCRS2026' })
    const result = await signup(db, {
      email: 'Ada@Edu.Pucrs.br',
      password: 'anotherpass',
      code: 'PUCRS2026',
    })

    expect(result).toEqual({ ok: false, error: 'signup_failed' })
  })
})

describe('auth.service login', () => {
  it('issues a token with sub, role, university and a 24h TTL for correct credentials', async () => {
    const signedUp = await signup(db, {
      email: 'ada@edu.pucrs.br',
      password: 'supersecret',
      code: 'PUCRS2026',
    })
    if (!signedUp.ok) throw new Error('expected signup to succeed')

    const result = await login(db, { email: 'ada@edu.pucrs.br', password: 'supersecret' })
    if (!result.ok) throw new Error('expected login to succeed')

    const verified = await verifyJwt(result.token, { secret: JWT_SECRET, claims: UserClaimsSchema })
    if (!verified.ok) throw new Error('expected token to verify')
    expect(verified.claims.sub).toBe(signedUp.user.id)
    expect(verified.claims.role).toBe('participant')
    expect(verified.claims.university).toBe('pucrs')

    const payload = JSON.parse(
      Buffer.from(result.token.split('.')[1] ?? '', 'base64url').toString(),
    )
    expect(payload.exp - payload.iat).toBe(60 * 60 * 24)
  })

  it('rejects a wrong password', async () => {
    await signup(db, { email: 'ada@edu.pucrs.br', password: 'supersecret', code: 'PUCRS2026' })

    const result = await login(db, { email: 'ada@edu.pucrs.br', password: 'wrong-password' })
    expect(result).toEqual({ ok: false, error: 'invalid_credentials' })
  })

  it('rejects an unknown email with the same shape as a wrong password', async () => {
    const result = await login(db, { email: 'nobody@edu.pucrs.br', password: 'supersecret' })
    expect(result).toEqual({ ok: false, error: 'invalid_credentials' })
  })

  it('rejects correct credentials for a deactivated account with the same shape', async () => {
    await signup(db, { email: 'ada@edu.pucrs.br', password: 'supersecret', code: 'PUCRS2026' })
    await db
      .update(usersTable)
      .set({ active: false })
      .where(eq(usersTable.email, 'ada@edu.pucrs.br'))

    const result = await login(db, { email: 'ada@edu.pucrs.br', password: 'supersecret' })
    expect(result).toEqual({ ok: false, error: 'invalid_credentials' })
  })
})

describe('ChangePasswordBodySchema', () => {
  it('rejects a new password under 8 characters', () => {
    const result = ChangePasswordBodySchema.safeParse({
      currentPassword: 'supersecret',
      newPassword: 'short1',
    })
    expect(result.success).toBe(false)
  })

  // The current password is verified against a real hash, so a length rule on
  // it would only reject people whose password predates the rule.
  it('accepts a short current password', () => {
    const result = ChangePasswordBodySchema.safeParse({
      currentPassword: 'k7fq',
      newPassword: 'brand-new-password',
    })
    expect(result.success).toBe(true)
  })
})

describe('auth.service changePassword', () => {
  async function createParticipant(password = 'supersecret') {
    const result = await signup(db, {
      email: 'ada@edu.pucrs.br',
      password,
      code: 'PUCRS2026',
    })
    if (!result.ok) throw new Error('expected signup to succeed')
    return result.user
  }

  it('swaps the password and clears the forced-change flag', async () => {
    const user = await createParticipant()
    await db.update(usersTable).set({ mustChangePassword: true }).where(eq(usersTable.id, user.id))

    expect(
      await changePassword(db, user.id, {
        currentPassword: 'supersecret',
        newPassword: 'brand-new-password',
      }),
    ).toEqual({ ok: true })

    const updated = await findUserById(db, user.id)
    expect(updated?.mustChangePassword).toBe(false)
    expect(
      await login(db, { email: 'ada@edu.pucrs.br', password: 'brand-new-password' }),
    ).toMatchObject({ ok: true })
    expect(await login(db, { email: 'ada@edu.pucrs.br', password: 'supersecret' })).toEqual({
      ok: false,
      error: 'invalid_credentials',
    })
  })

  it('changes nothing when the current password is wrong', async () => {
    const user = await createParticipant()
    await db.update(usersTable).set({ mustChangePassword: true }).where(eq(usersTable.id, user.id))
    const before = await findUserById(db, user.id)

    expect(
      await changePassword(db, user.id, {
        currentPassword: 'not-my-password',
        newPassword: 'brand-new-password',
      }),
    ).toEqual({ ok: false, error: 'invalid_credentials' })

    const after = await findUserById(db, user.id)
    expect(after?.passwordHash).toBe(before?.passwordHash)
    expect(after?.mustChangePassword).toBe(true)
  })

  it('drops a pending OTP, so an old code cannot overwrite the new password', async () => {
    const user = await createParticipant()
    await issuePasswordResetOtp(db, user.id)

    await changePassword(db, user.id, {
      currentPassword: 'supersecret',
      newPassword: 'brand-new-password',
    })

    const otps = await db
      .select()
      .from(passwordResetOtpsTable)
      .where(eq(passwordResetOtpsTable.userId, user.id))
    expect(otps).toHaveLength(0)
  })

  it('reports invalid_credentials for an unknown user', async () => {
    expect(
      await changePassword(db, '00000000-0000-0000-0000-000000000000', {
        currentPassword: 'supersecret',
        newPassword: 'brand-new-password',
      }),
    ).toEqual({ ok: false, error: 'invalid_credentials' })
  })
})
