import { verifyJwt } from '@katajs-framework/core/jwt'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { JWT_SECRET } from '../../config'
import { createDb } from '../../db/client'
import { eventCodesTable, usersTable } from '../../db/schema'
import { UserClaimsSchema } from '../users/users.schema'

import { LoginBodySchema, SignupBodySchema } from './auth.schema'
import { login, signup } from './auth.service'

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
