# argon2 behind a limit in the app (#447)

#436 measured the signup peak and found that, at 64 requests in flight,
every authenticated route waited behind the argon2 queue. The organizer's
panel answered in 4.6–6.0 s (p50), against 3 ms at rest. Its inference:
kata's `jwtAuth` verifies each JWT with WebCrypto, and Node runs that HMAC
on the same libuv threadpool (4 threads) as argon2, so each verification
waited in the pool's FIFO queue behind every queued hash.

This report first confirms that inference, then measures the fix. Every
argon2 hash and verification of the app now goes through one semaphore of
`ARGON2_CONCURRENCY` (default 3, `back/src/lib/argon2.ts`), so one thread of
the pool always stays free for the JWTs.

The command and the protocol are #436's: `pnpm load:baseline
--setup-concurrency N --sse 0 --rest 30 --duration 1`, 30 s of rest
followed by the setup (300 signups, 300 logins, 100 teams, 200 joins), the
organizer's panel polling `/organizer/stats/live` and
`/organizer/stats/process` once per second. The raw reports are in
[`447/`](447/). Each run's `noise.log` and the probe's log match the
repository's `*.log` ignore rule, so they were not committed: the
Environment section summarizes what they recorded.

## Verdict

| acceptance | runs | measured | result |
|---|---|---|---|
| 1: the panel (`GET /organizer/stats/live`) with p95 < 500 ms during the setup at N = 64 | after N64a, N64b | p95 85 ms and 87 ms (max 216 / 215 ms) | PASS |
| 2: throughput ≥ 90% of #436's at N = 64 (7.4 operations/s), with no 5xx, network error or timeout | after N64a, N64b | 8.78 and 8.65 operations/s, 0 / 0 / 0 | PASS |
| 3: if the inference does not hold, record the measured cause before changing anything | before P64 + the unit test | the inference holds (below), posted on #447 before the change was committed | PASS |

The throughput did not drop, it rose by about 5%: 8.34 → 8.78 and 8.65
operations/s, the setup 72 s → 68–69 s.

## Confirmation (before the change)

**(a) The mechanism, isolated.** `back/src/lib/argon2.test.ts` signs a JWT,
starts 8 `argon2.verify` (each one hands its job to the pool synchronously,
as a request already in flight has done) and then calls `verifyJwt` from
`@katajs-framework/core/jwt`, the function `jwtAuth` calls. It asserts that
the verification finishes before the first argon2 job. Without the limit
it failed three times out of three (`expected 'argon2-0' | 'argon2-3' |
'argon2-2' to be 'jwt'`). With the limit it passes. With
`ARGON2_CONCURRENCY=4`, the size of the pool, it fails again.

A first version used 8 `argon2.hash` and passed without the limit.
`argon2.hash` first awaits a `randomBytes` salt (also a pool job) and only
then queues the hash, so a JWT started right after them got in first. A
burst of verifications is the faithful case: in the real peak, the argon2
jobs are already in the pool when the JWT arrives.

**(b) A probe at the peak** (`before P64`, never committed). A throwaway
wrapper around `requireUser` wrote, for each authenticated request, the time
from the middleware's start to the entry into `resolve` (the JWT
verification), the time inside `resolve` (`findUserById`, the database) and
the middleware's total. During the setup:

| route | n | JWT verification p50 / p95 ms | `resolve` (database) p50 / p95 ms | total p50 / p95 ms | verification / total (p50) |
|---|---|---|---|---|---|
| `GET /organizer/stats/live` | 11 | 5,802 / 7,294 | 77 / 200 | 6,002 / 7,300 | 98.5% |
| `GET /organizer/stats/process` | 11 | 5,802 / 7,294 | 76 / 282 | 6,084 / 7,301 | 98.5% |
| `POST /teams` (after the users) | 100 | 3.2 / 9.7 | 17 / 57 | 78 / 107 | 3.5% |
| `POST /teams/:id/join` | 200 | 1.1 / 2.9 | 26 / 62 | 126 / 136 | 1.1% |

The plan's threshold was ≥ 80% of the panel's p50 in the verification,
with the database in the tens of milliseconds. The verification took
98.5% of it, the database 77 ms. Teams and joins, which run once the pool
has drained, verified their JWT in 1–3 ms.

## Results

The latencies are from the `setup` phase. "rest" is the 30 s before it.
The #436 columns are its two clean N = 64 runs (`436/N64a-2-muxflprr`,
`436/N64b-muxewxii`). "before P64" is this branch before the change, with
the probe. "after" is this branch with the limit at its default of 3.

| | #436 N64a | #436 N64b | before P64 | after N64a | after N64b |
|---|---|---|---|---|---|
| setup duration s | 71.9 | 73.0 | 72.0 | 68.4 | 69.4 |
| argon2 operations/s (600 / setup) | 8.34 | 8.22 | 8.34 | 8.78 | 8.65 |
| `POST /auth/signup` p50 / p95 / max s | 5.60 / 12.00 / 13.27 | 4.63 / 8.49 / 14.21 | 4.38 / 7.77 / 14.29 | 7.20 / 7.40 / 7.58 | 7.21 / 7.40 / 7.50 |
| `POST /auth/login` p50 / p95 / max s | 8.71 / 12.59 / 14.20 | 9.92 / 13.69 / 14.69 | 9.82 / 13.80 / 14.60 | 7.19 / 7.39 / 7.49 | 7.22 / 7.39 / 7.48 |
| `POST /teams` p50 / max ms | 120 / 202 | 113 / 174 | 83 / 135 | 75 / 128 | 207 / 315 |
| `POST /teams/:id/join` p50 / max ms | 136 / 165 | 129 / 159 | 128 / 144 | 131 / 186 | 252 / 452 |
| panel `GET /organizer/stats/live` in setup, p50 / p95 / max ms | 4,587 / 7,002 / 7,002 | 6,021 / 7,190 / 7,190 | 6,004 / 7,303 / 7,303 | **8 / 85 / 216** | **7 / 87 / 215** |
| `GET /organizer/stats/process` in setup, p50 / p95 / max ms | 4,589 / 7,003 / 7,003 | 6,021 / 7,190 / 7,190 | 6,086 / 7,303 / 7,303 | 7 / 85 / 210 | 7 / 87 / 212 |
| the panel at rest, p50 / max ms | 3.3 / 7.0 | 3.6 / 16.7 | 3.5 / 15.2 | 3.4 / 15.2 | 3.3 / 14.6 |
| panel polls answered during the setup | 15 | 11 | 11 | 67 | 67 |
| back lag p99 / max ms (setup) | 279 / 279 | 189 / 189 | 100 / 100 | 86 / 86 | 95 / 95 |
| back ELU mean (setup) | 0.076 | 0.084 | 0.072 | 0.073 | 0.080 |
| back CPU % of a core, mean / max | 131 / 144 | 130 / 141 | 128 / 140 | 124 / 138 | 122 / 141 |
| back RSS max MiB (rest → setup) | 279 → 490 | 278 → 535 | 296 → 554 | 295 → 490 | 278 → 473 |
| back heap max MiB | 99 | 99 | 100 | 101 | 100 |
| back threads, rest → setup max (`ps nlwp`) | 11 → 22 | 11 → 23 | 12 → 25 | 12 → 24 | 11 → 22 |
| 5xx / network errors / timeouts | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| harness saturated in setup | no | no | no | no | no |

- **The panel is back to the event-loop floor.** At N = 64 it answered in
  7–8 ms (p50) and 85–87 ms (p95) during the setup, against 6.0 s before.
  It answered 67 of its once-per-second polls during a 68–69 s setup,
  against 11–15. Its p95 is the back's own lag (p99 86–95 ms).
- **Signup and login keep the same wait, as expected.** Little's law sets
  it: 64 in flight at ~8.7 operations/s is ~7.3 s each, and both took 7.2 s
  (p50). The queue moved from libuv into the app; it did not shrink.
- **The wait is now even.** The p95 of signup and login is 7.4 s, a few
  hundred ms above their p50, against 7.8–13.8 s before. The app's queue
  is FIFO and admits no newcomer ahead of a waiter.
- **Login no longer waits twice as long as signup** (7.2 s against 7.2 s,
  before 8.7–9.9 s against 4.4–5.6 s). After `argon2.verify`, the login
  signs its JWT with `signJwt`, which is also a WebCrypto job on the pool.
  Before, that second job queued behind every hash already in the pool. Now
  the free thread takes it at once. This explains #436's open question, but
  it is an observation and not an acceptance.
- **The throughput rose by about 5%**, with a little less CPU (122–124%
  against 128–131% of a core). Three argon2 jobs at a time, each with its
  own lane threads (`p=4`), still keep the 2-CPU quota busy, and a little less
  contention seems to pay for the fourth thread. That was not a goal and is
  within what two runs can show.
- **Teams and joins in after N64b** (p50 207 / 252 ms) were slower than in
  every other run (75–131 ms), with the same back, the same commit and a
  clean `noise.log`. They run after the users, with no argon2 in flight,
  so the limit does not touch them. Nothing in this run explains it; it
  stays recorded as an observation.
- **Memory and threads do not change.** RSS peaked at 473–490 MiB, against
  490–554 MiB, and the thread count at 22–24, against 22–25.

## The control (N = 4)

| | #436 C4 | after C4 |
|---|---|---|
| setup duration s | 72.3 | 69.5 |
| argon2 operations/s (600 / setup) | 8.30 | 8.64 |
| `POST /auth/signup` p50 / p95 / max s | 0.50 / 0.59 / 0.79 | 0.41 / 0.69 / 0.79 |
| `POST /auth/login` p50 / p95 / max s | 0.49 / 0.57 / 0.60 | 0.41 / 0.61 / 0.79 |
| `POST /teams` p50 / max ms | 17 / 35 | 8 / 15 |
| `POST /teams/:id/join` p50 / max ms | 18 / 38 | 11 / 21 |
| panel `GET /organizer/stats/live` in setup, p50 / p95 / max ms | 89 / 301 / 396 | 6 / 88 / 93 |
| the panel at rest, p50 / max ms | 3.3 / 15.8 | 3.4 / 16.1 |
| panel polls answered during the setup | 65 | 68 |
| back lag p99 / max ms (setup) | 95 / 95 | 85 / 85 |
| back CPU % of a core, mean / max | 134 / 147 | 124 / 140 |
| back RSS max MiB (rest → setup) | 296 → 490 | 279 → 474 |
| back threads, rest → setup max (`ps nlwp`) | 12 → 23 | 11 → 23 |
| 5xx / network errors / timeouts | 0 / 0 / 0 | 0 / 0 / 0 |

With 4 requests in flight the machine matches #436's control: about
70 s of setup, signup and login at about 0.5 s. Even at N = 4 the panel
used to wait (p95 301 ms) whenever 4 argon2 jobs filled the pool. With one
thread free it stays at the event-loop floor.

## Environment

- **The back:** this branch, under `systemd-run --user --scope -p
  CPUQuota=200% -p MemoryMax=4G -p MemorySwapMax=0`, verified on every
  scope (`CPUQuotaPerSecUSec=2s`, `MemoryMax=4294967296`,
  `MemorySwapMax=0`). Node v24.21.0, default `UV_THREADPOOL_SIZE` (4),
  `ARGON2_CONCURRENCY` unset (its default, 3). "before P64" ran at
  `ea8f503` (the unit test and the unused wrapper; the services still
  called `argon2` directly) plus the uncommitted probe. "after" ran at
  `fe0ed59`, the change complete. The harness ran from the same tree, so
  each report's `commit` is the back's.
- **Each cycle** followed #436's protocol. The database was reset (`pnpm
  worktree:env --reset`), the back booted, the harness ran, and the back
  stopped. The whole cycle held `flock /tmp/kumite-load.lock` and the
  machine's E2E slot (`/tmp/kumite-e2e-slot-1.lock`). It waited for a
  1-minute load under 2 and no `playwright|vitest|lefthook|chrom` process,
  and a `noise.log` recorded the load, that check and the `ps` of the back
  and the harness every 5 s.
- **The machine:** 12 logical CPUs, 7.7 GiB RAM, WSL2. Another session's
  load runs (#439) shared the lock, one cycle at a time.
- **A discarded attempt.** The first probe run (17:50 UTC, `mv8eniyu`)
  read the request path from the wrong object and answered 500 on every
  authenticated route; it measured nothing and its raws were not kept.

| run | started (UTC, 2026-10-14) | harness load average (1/5/15 min), start → end | concurrent processes in `noise.log` |
|---|---|---|---|
| before P64 | 18:00 | 1.71 / 2.09 / 2.02 → 3.42 / 2.16 / 2.03 | none (0 of 21 samples) |
| after N64a | 18:09 | 1.75 / 1.84 / 1.88 → 3.96 / 2.20 / 1.97 | none (0 of 20) |
| after N64b | 18:17 | 1.79 / 2.18 / 2.01 → 2.74 / 2.51 / 2.15 | none (0 of 21) |
| after C4 | 18:24 | 1.67 / 2.32 / 2.16 → 3.33 / 2.74 / 2.32 | none (0 of 21) |

Pending: confirmation on the VPS (#139). `UV_THREADPOOL_SIZE` and the
argon2 parameters stay as they are (#436, options 2 and 3).
