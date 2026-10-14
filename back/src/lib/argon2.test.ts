import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { signJwt, verifyJwt } from '@katajs-framework/core/jwt'
import argon2 from 'argon2'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { ARGON2_CONCURRENCY } from '../config'
import { argon2Hash, argon2Verify } from './argon2'

const SECRET = 'argon2-test-secret'
const Claims = z.object({ sub: z.string() })

describe('argon2Hash and the libuv threadpool (#447)', () => {
  // Every authenticated route verifies its JWT through kata's jwtAuth →
  // hono/jwt → WebCrypto, whose HMAC runs on the same libuv threadpool (4
  // threads by default) as argon2. Without a limit in the app, a burst of
  // hashes fills every thread and the verification waits in the pool's FIFO
  // queue behind all of them. An ordering assertion, not a timing one: the
  // verification must finish before the first argon2 job does.
  //
  // The burst is of verifications (a login rush) because argon2.verify hands
  // its job to the pool synchronously, as a request already in flight would
  // have done; argon2.hash first awaits a randomBytes salt (itself a pool job),
  // so a JWT started right after a burst of hashes would slip in ahead of them
  // and the test would pass for the wrong reason.
  it('leaves a threadpool thread free for a JWT verification during a burst of argon2 jobs', async () => {
    const digest = await argon2Hash('password')
    const token = await signJwt({}, { secret: SECRET, subject: 'u1', expiresInSeconds: 60 })
    const finished: string[] = []

    const jobs = Array.from({ length: 8 }, (_, i) =>
      argon2Verify(digest, 'password').then(() => {
        finished.push(`argon2-${i}`)
      }),
    )
    const verification = verifyJwt(token, { secret: SECRET, claims: Claims }).then((result) => {
      finished.push('jwt')
      return result
    })

    const result = await verification
    await Promise.all(jobs)

    expect(result.ok).toBe(true)
    expect(finished[0]).toBe('jwt')
  }, 30_000)
})

describe('argon2Hash and argon2Verify share one queue (#447)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it(`keeps at most ARGON2_CONCURRENCY hashes and verifications in flight`, async () => {
    const pending: Array<() => void> = []
    const hold = <T>(value: T) =>
      new Promise<T>((resolve) => {
        pending.push(() => resolve(value))
      })
    const hash = vi.spyOn(argon2, 'hash').mockImplementation(() => hold('stubbed-hash'))
    const verify = vi.spyOn(argon2, 'verify').mockImplementation(() => hold(true))
    const started = () => hash.mock.calls.length + verify.mock.calls.length
    const total = ARGON2_CONCURRENCY + 2

    const calls = Array.from({ length: total }, (_, i) =>
      i % 2 === 0 ? argon2Hash(`p${i}`) : argon2Verify('digest', `p${i}`),
    )

    expect(started()).toBe(ARGON2_CONCURRENCY)
    for (let done = 1; done <= total; done++) {
      pending.shift()?.()
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(started()).toBe(Math.min(total, ARGON2_CONCURRENCY + done))
    }
    await Promise.all(calls)
  })
})

describe('every argon2 call of the API goes through the queue (#447)', () => {
  // A module that imports argon2 itself hashes on the threadpool past the
  // limit, and a rush through it would stall every JWT again — with every
  // other test still green. Only this wrapper and the seed (a standalone
  // script, never the API process) may import it.
  it('no source file but lib/argon2.ts and db/seed.ts imports argon2', () => {
    const src = fileURLToPath(new URL('..', import.meta.url))
    const importsArgon2 = /(?:from\s*|import\(\s*|require\(\s*)['"]argon2['"]/
    const importers = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .filter((file) => importsArgon2.test(readFileSync(join(src, file), 'utf8')))
      .map((file) => file.split(sep).join('/'))
      .sort()

    expect(importers).toEqual(['db/seed.ts', 'lib/argon2.ts'])
  })
})
