import { afterAll, describe, expect, it } from 'vitest'

import { app } from './app'
import { APP_MAX_BODY_BYTES, SUBMISSION_MAX_BODY_BYTES } from './config'
import { k } from './context'
import {
  ChangePasswordBodySchema,
  LoginBodySchema,
  PASSWORD_MAX_LENGTH,
  SignupBodySchema,
  VERIFIED_PASSWORD_MAX_LENGTH,
} from './modules/auth/auth.schema'
import { CompletePasswordResetBodySchema } from './modules/password-reset/password-reset.schema'

// Cross-module suite (#287), at src/ root like uuid-params.test.ts: the
// request-size ceilings the public routes now enforce. None of these requests
// reach a handler — bodyLimit short-circuits first — so no database state is
// needed, but the app still resolves its `db` singleton and the socket has to
// be closed like everywhere else.

afterAll(async () => {
  await k.resolve('db').$client.end()
})

const json = { 'Content-Type': 'application/json' }
const overAppLimit = 'x'.repeat(APP_MAX_BODY_BYTES + 1)

describe('app-wide body limit', () => {
  it.each(['/auth/login', '/auth/signup', '/auth/request-password-reset', '/bug-reports'])(
    'answers 413 to an oversized body on the public route %s',
    async (path) => {
      const res = await app.request(path, { method: 'POST', headers: json, body: overAppLimit })
      expect(res.status).toBe(413)
    },
  )

  it('lets a body under the ceiling through to validation', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: 'x@example.com', password: 'p'.repeat(1000) }),
    })
    // Not 413: the request reached zod (password has no min(8) on login, so this
    // one goes on to the handler and is refused as bad credentials).
    expect(res.status).not.toBe(413)
  })

  it('keeps the stricter route-level ceiling on POST /submissions', async () => {
    // Between the two limits: past the route's 256 KB, under the app's 512 KB.
    const body = 'x'.repeat(SUBMISSION_MAX_BODY_BYTES + 1)
    expect(body.length).toBeLessThan(APP_MAX_BODY_BYTES)
    const res = await app.request('/submissions', { method: 'POST', headers: json, body })
    expect(res.status).toBe(413)
  })
})

describe('password length ceilings', () => {
  const base = { name: 'Ada Lovelace', email: 'ada@edu.pucrs.br', code: 'PUCRS2026' }

  it('caps a password being set at PASSWORD_MAX_LENGTH', () => {
    expect(
      SignupBodySchema.safeParse({ ...base, password: 'p'.repeat(PASSWORD_MAX_LENGTH) }).success,
    ).toBe(true)
    expect(
      SignupBodySchema.safeParse({ ...base, password: 'p'.repeat(PASSWORD_MAX_LENGTH + 1) })
        .success,
    ).toBe(false)
    expect(
      ChangePasswordBodySchema.safeParse({
        currentPassword: 'x',
        newPassword: 'p'.repeat(PASSWORD_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)
    expect(
      CompletePasswordResetBodySchema.safeParse({
        email: 'ada@edu.pucrs.br',
        otp: '123456',
        newPassword: 'p'.repeat(PASSWORD_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it('gives a password only being verified the looser ceiling', () => {
    expect(
      LoginBodySchema.safeParse({
        email: 'ada@edu.pucrs.br',
        password: 'p'.repeat(VERIFIED_PASSWORD_MAX_LENGTH),
      }).success,
    ).toBe(true)
    expect(
      LoginBodySchema.safeParse({
        email: 'ada@edu.pucrs.br',
        password: 'p'.repeat(VERIFIED_PASSWORD_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)
  })
})
