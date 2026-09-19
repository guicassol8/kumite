import { signJwt } from '@katajs-framework/core/jwt'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from './app'
import {
  APP_MAX_BODY_BYTES,
  JWT_SECRET,
  SUBMISSION_MAX_BODY_BYTES,
  TOKEN_TTL_SECONDS,
} from './config'
import { k } from './context'
import { usersTable } from './db/schema'
import {
  ChangePasswordBodySchema,
  LoginBodySchema,
  PASSWORD_MAX_LENGTH,
  SignupBodySchema,
  VERIFIED_PASSWORD_MAX_LENGTH,
} from './modules/auth/auth.schema'
import {
  EVENT_MAX_TEAM_SIZE,
  UpdateEventConfigBodySchema,
} from './modules/event-config/event-config.schema'
import { CompletePasswordResetBodySchema } from './modules/password-reset/password-reset.schema'
import {
  CreateProblemBodySchema,
  PROBLEM_POINTS_MAX,
  UpdateProblemBodySchema,
} from './modules/problems/problems.schema'

// Cross-module suite (#287), at src/ root like uuid-params.test.ts: the
// request-size ceilings the public routes now enforce. None of these requests
// reach a handler — bodyLimit short-circuits first — so no database state is
// needed, but the app still resolves its `db` singleton and the socket has to
// be closed like everywhere else.

const db = k.resolve('db')

afterAll(async () => {
  await db.$client.end()
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
    // one goes on to the handler and is refused as bad credentials). Asserting
    // the 401 itself, not merely "something other than 413" — a 500 would
    // otherwise pass this as happily as the behaviour it is meant to pin.
    expect(res.status).toBe(401)
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

  // The acceptance line for #287 is about the status the *system* answers, not
  // about what the schema accepts: pin it end-to-end so a change in kata's
  // validation envelope (or a route that stops using this schema) is caught
  // here and not in production.
  it('answers 422 to a signup whose password is over PASSWORD_MAX_LENGTH', async () => {
    const res = await app.request('/auth/signup', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ ...base, password: 'p'.repeat(PASSWORD_MAX_LENGTH + 1) }),
    })
    expect(res.status).toBe(422)
    const body = (await res.json()) as { issues?: { body?: { path?: string }[] } }
    expect(body.issues?.body?.some((issue) => issue.path === 'password')).toBe(true)
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

// Numeric ceilings on the organizer's two write surfaces (#187), same shape as
// the password ceilings above: the schema is pinned directly *and* end-to-end,
// because what the organizer's screen needs is the 422 envelope with the
// field's own path in it. Without a `.max()` these values sailed past zod and
// died in Postgres as an int4 overflow — a 500 carrying no `issues` at all.
describe('numeric field ceilings', () => {
  const NIL_ID = '00000000-0000-0000-0000-000000000000'

  beforeEach(async () => {
    await db.execute(sql`truncate table ${usersTable} restart identity cascade`)
  })

  async function organizerToken() {
    const [user] = await db
      .insert(usersTable)
      .values({
        email: `organizer-${crypto.randomUUID()}@example.com`,
        passwordHash: 'hash',
        role: 'organizer',
        university: 'pucrs',
      })
      .returning()
    if (!user) throw new Error('expected user to be inserted')
    return signJwt(
      { role: user.role, university: user.university },
      { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
    )
  }

  async function organizerRequest(path: string, method: string, body: unknown) {
    return app.request(path, {
      method,
      headers: { ...json, Authorization: `Bearer ${await organizerToken()}` },
      body: JSON.stringify(body),
    })
  }

  // Every probe below asserts the *path*, not merely the status: a 422 raised
  // by an unrelated field would otherwise pass for the ceiling being enforced.
  async function issuePaths(res: Response) {
    const body = (await res.json()) as { issues?: { body?: { path?: string }[] } }
    return (body.issues?.body ?? []).map((issue) => issue.path)
  }

  // Guard against a vacuous suite: vitest transpiles without typechecking, so a
  // constant that does not exist arrives as `undefined`, every `MAX + 1` becomes
  // NaN and every "rejects one over" assertion below passes for the wrong
  // reason. Pinning both as real positive integers is what makes the rest mean
  // something.
  //
  // The literals are pinned too, and that is the half that catches drift. Every
  // other assertion in this file is written relative to the constant, so raising
  // a ceiling here alone keeps this suite green while the front keeps promising
  // the old limit — `front/src/lib/field-limits.ts` mirrors these by hand and
  // no type ties the two together (`.max()` does not change the inferred type,
  // so `hc<AppType>` cannot carry it). front/src/lib/field-limits.test.ts pins
  // the same two numbers; changing one side without the other turns one of the
  // two suites red instead of silently shipping a wrong limit to the organizer.
  it('pins both ceilings to the literals the front mirrors', () => {
    expect(Number.isInteger(PROBLEM_POINTS_MAX)).toBe(true)
    expect(PROBLEM_POINTS_MAX).toBeGreaterThan(0)
    expect(Number.isInteger(EVENT_MAX_TEAM_SIZE)).toBe(true)
    expect(EVENT_MAX_TEAM_SIZE).toBeGreaterThan(0)

    expect(PROBLEM_POINTS_MAX).toBe(10_000)
    expect(EVENT_MAX_TEAM_SIZE).toBe(10)
  })

  it("caps a problem's points at PROBLEM_POINTS_MAX on both write schemas", () => {
    const create = (points: number) =>
      CreateProblemBodySchema.safeParse({ difficulty: 'easy', points })
    expect(create(PROBLEM_POINTS_MAX).success).toBe(true)
    expect(create(PROBLEM_POINTS_MAX + 1).success).toBe(false)
    expect(UpdateProblemBodySchema.safeParse({ points: PROBLEM_POINTS_MAX }).success).toBe(true)
    expect(UpdateProblemBodySchema.safeParse({ points: PROBLEM_POINTS_MAX + 1 }).success).toBe(
      false,
    )
  })

  it('caps maxTeamSize at EVENT_MAX_TEAM_SIZE', () => {
    expect(
      UpdateEventConfigBodySchema.safeParse({ maxTeamSize: EVENT_MAX_TEAM_SIZE }).success,
    ).toBe(true)
    expect(
      UpdateEventConfigBodySchema.safeParse({ maxTeamSize: EVENT_MAX_TEAM_SIZE + 1 }).success,
    ).toBe(false)
  })

  it('answers 422 naming `points` when a problem is created over the ceiling', async () => {
    const res = await organizerRequest('/organizer/problems', 'POST', {
      difficulty: 'easy',
      points: PROBLEM_POINTS_MAX + 1,
    })
    expect(res.status).toBe(422)
    expect(await issuePaths(res)).toContain('points')
  })

  it('answers 422 naming `points` when a problem is patched over the ceiling', async () => {
    // The nil id never reaches a lookup: input validation runs at the edge,
    // before the handler, so the body alone decides the answer here.
    const res = await organizerRequest(`/organizer/problems/${NIL_ID}`, 'PATCH', {
      points: PROBLEM_POINTS_MAX + 1,
    })
    expect(res.status).toBe(422)
    expect(await issuePaths(res)).toContain('points')
  })

  it('answers 422 naming `maxTeamSize` when the event is configured over the ceiling', async () => {
    const res = await organizerRequest('/organizer/event-config', 'PATCH', {
      maxTeamSize: EVENT_MAX_TEAM_SIZE + 1,
    })
    expect(res.status).toBe(422)
    expect(await issuePaths(res)).toContain('maxTeamSize')
  })

  // Not a discovery, a version lock: kata flattens nested paths through
  // `pathToDotNotation`, which is what lets the front match `testCases[0].hidden`
  // literally. A kata upgrade that switched to an array — or to
  // `testCases.0.hidden` — would silently stop every per-field message on the
  // problem form, and this is the only place that would say so.
  it('flattens a nested path to bracket notation in the 422 envelope', async () => {
    const res = await organizerRequest(`/organizer/problems/${NIL_ID}`, 'PATCH', {
      testCases: [{ input: 1, expected: 1, hidden: 'nope' }],
    })
    expect(res.status).toBe(422)
    expect(await issuePaths(res)).toContain('testCases[0].hidden')
  })
})
