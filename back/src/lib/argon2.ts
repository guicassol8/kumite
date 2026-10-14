import argon2 from 'argon2'

import { ARGON2_CONCURRENCY } from '../config'
import { createSemaphore } from './semaphore'

// Every argon2 hash and verification of the app goes through here (#447).
//
// argon2 runs on libuv's threadpool (4 threads unless UV_THREADPOOL_SIZE says
// otherwise), and so does the WebCrypto HMAC with which kata's jwtAuth
// verifies the JWT of every authenticated request. The pool is one FIFO
// queue: during a signup rush (#436) every thread was hashing and each JWT
// waited behind every queued hash — the organizer's panel took 4.6–6.0 s
// (p50) at 64 requests in flight, against 3 ms at rest. One semaphore,
// shared by hashes and verifications, keeps at most ARGON2_CONCURRENCY of
// them on the pool, so a thread always stays free for the JWTs; the rest of
// the queue waits here, in the app.
//
// The timing parity of ADR-0003/0004 still holds: the real path and the
// dummy one (unknown email, throttled reset, wrong step-up) call the same
// function and wait in the same queue, so they still cost the same.
//
// `argon2.hash`/`argon2.verify` are read from the default export on every
// call, never destructured at import, so a test's vi.spyOn(argon2, 'hash')
// still sees the calls.
const argon2Queue = createSemaphore(ARGON2_CONCURRENCY)

export function argon2Hash(plain: string): Promise<string> {
  return argon2Queue.run(() => argon2.hash(plain))
}

export function argon2Verify(hash: string, plain: string): Promise<boolean> {
  return argon2Queue.run(() => argon2.verify(hash, plain))
}
