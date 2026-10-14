# jwtAuth's verification queues behind CPU-heavy threadpool work

**Found while**: #436 (measuring the signup peak against a back limited to
2 CPUs / 4 GB), `docs/load/436-signup-peak.md`
**Where in kata**: `@katajs-framework/core/jwt`: `jwtAuth` → `verifyJwt`,
which calls `verify` from `hono/jwt` (`dist/jwt/index.js`)

## What

`hono/jwt` signs and verifies with WebCrypto (`crypto.subtle`). On Node,
WebCrypto's HMAC runs as an async job on the libuv threadpool, which has 4
threads by default. In kumite those same threads hash passwords with
argon2 (64 MiB, t=3, about 0.5 s each under the 2-CPU limit).

During a signup peak with 64 requests in flight, every authenticated route
answered in p50 4.6–6.0 s: the organizer panel went from 3 ms at rest to
that. In the same seconds, the event-loop lag was 189–279 ms, and the one
unauthenticated route (`/health`) answered in p50 67 ms. The numbers point
to each JWT verification waiting in the threadpool's FIFO queue behind
every queued argon2 job.

**Measured in #447** (`docs/load/447-argon2-limit.md`). A throwaway probe in
kumite's `requireUser` timed each request from the middleware's start to
the entry into `resolve`, which is `verifyJwt`, and then `resolve` itself
(the database). In the same peak, the panel's p50 was 6.0 s, and 98.5% of
it (p50 5.8 s) was the JWT verification. The database took 77 ms. In
isolation, a unit test that queues 8 `argon2.verify` before one
`verifyJwt` sees the verification finish after an argon2 job, every time.
kumite fixed it on its side: at most 3 argon2 jobs at a time, so one of the
4 threads stays free for WebCrypto. In the same peak, the panel's p95 then
dropped to 85–87 ms.

`signJwt` goes through the same pool (`crypto.subtle.sign`), so a login,
which runs `argon2.verify` and then `signJwt`, used to queue twice. That
made it wait about twice as long as a signup at the peak. With the free
thread, the two now take the same time.

## Why it matters

Any kata app that does CPU-heavy work on the libuv threadpool (password
hashing being the obvious case, but also `zlib`, `fs` or `crypto.scrypt`)
makes **every authenticated request** wait for it, through `jwtAuth`. Nothing
in kata's docs or JSDoc says the verification is threadpool-bound. A reader
would assume an HMAC check is a few microseconds on the main thread.

## Suggested fix (optional)

- Document in `jwtAuth`/`verifyJwt`'s JSDoc that HS* verification goes
  through WebCrypto and the libuv threadpool.
- Or offer a synchronous HS* path (`node:crypto` `createHmac` +
  `timingSafeEqual` on the main thread, microseconds for a short token),
  so the authentication of a request never queues behind unrelated
  threadpool work.

## Numbers

0 docs lookups (the JWT path was read from the installed package: `dist/jwt/
index.js` imports `sign, verify` from `hono/jwt`). `kata verify` ran only as
a gate: pre-commit ×6 and pre-push ×2, with 0 findings. No turns were lost
to kata friction.
