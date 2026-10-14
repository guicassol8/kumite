import { signJwt, verifyJwt } from '@katajs-framework/core/jwt'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

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
