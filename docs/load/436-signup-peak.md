# The signup peak (#436)

#136 measured the harness's setup with 4 requests in flight: 300 signups
and 300 logins at about 8 argon2 operations per second. This report
measures the event's opening rush with 16, 32 and 64 requests in flight,
against the back limited to the VPS's size. For each run it records the
latency of signup, login and the routes that run during the peak, the
back's event-loop lag, its CPU and its memory.

The command is `pnpm load:baseline --setup-concurrency N --sse 0 --rest 30
--duration 1`. With `--sse 0` and `--duration 1`, a run is reduced to 30 s
of rest followed by the setup: 300 signups, 300 logins, 100 teams and 200
joins. The organizer panel polls `/organizer/stats/live` and
`/organizer/stats/process` once per second throughout. The raw reports and
`noise.log` are in [`436/`](436/).

## Verdict

- **Acceptance 1 (latency per route, event-loop lag and RSS of each run
  with 16, 32 and 64 in flight): done.** It is in the tables below, two
  clean runs per N plus a control at N = 4.
- **Acceptance 2 (a 5xx, a timeout or an RSS near 4 GB is a finding, with
  its N): none happened.** No run had a 5xx, a network error or a timeout:
  the slowest request took 14.7 s, against a 60 s timeout. No back was
  killed by its cgroup. The highest RSS was 535 MiB at N = 64, 13% of the
  4 GiB limit and far below the 3 GiB the plan set as "near". The finding is
  a different one (below): **every authenticated route waits behind the
  argon2 queue.**

## The argon2 parameters

`argon2.hash(password)` is called without options (`auth.service.ts`), so
it uses the defaults of `argon2` 0.45.1: argon2id with `m=65536` (64 MiB),
`t=3` and `p=4`. The service's dummy hash for unknown accounts carries the
same `m=65536,p=4,t=3`. The hashes and verifications run on Node's libuv
threadpool, which has the default 4 threads (`UV_THREADPOOL_SIZE` unset).

## Results

All the runs below are clean: nothing else ran on the machine (see
Environment). The latencies are from the `setup` phase. "rest" is the 30 s
before it.

| | C4 | N16a | N16b | N32a | N32b | N64a | N64b |
|---|---|---|---|---|---|---|---|
| requests in flight | 4 | 16 | 16 | 32 | 32 | 64 | 64 |
| setup duration s | 72.3 | 76.2 | 71.4 | 71.6 | 72.3 | 71.9 | 73.0 |
| argon2 operations/s (600 / setup) | 8.3 | 7.9 | 8.4 | 8.4 | 8.3 | 8.3 | 8.2 |
| `POST /auth/signup` p50 / p95 / max s | 0.50 / 0.59 / 0.79 | 1.99 / 2.70 / 3.19 | 1.80 / 2.41 / 2.70 | 3.71 / 5.10 / 5.67 | 3.39 / 5.70 / 6.30 | 5.60 / 12.00 / 13.27 | 4.63 / 8.49 / 14.21 |
| `POST /auth/login` p50 / p95 / max s | 0.49 / 0.57 / 0.60 | 2.01 / 2.69 / 3.01 | 1.99 / 2.59 / 3.02 | 3.79 / 5.50 / 6.89 | 4.08 / 6.10 / 6.92 | 8.71 / 12.59 / 14.20 | 9.92 / 13.69 / 14.69 |
| `POST /teams` p50 / max ms | 17 / 35 | 28 / 80 | 26 / 40 | 48 / 67 | 99 / 133 | 120 / 202 | 113 / 174 |
| `POST /teams/:id/join` p50 / max ms | 18 / 38 | 40 / 69 | 36 / 63 | 70 / 90 | 117 / 184 | 136 / 165 | 129 / 159 |
| panel `GET /organizer/stats/live` in setup, p50 / p95 / max ms | 89 / 301 / 396 | 882 / 1,396 / 1,515 | 717 / 1,410 / 1,494 | 1,477 / 2,297 / 3,380 | 1,787 / 3,193 / 3,485 | 4,587 / 7,002 / 7,002 | 6,021 / 7,190 / 7,190 |
| the same at rest, p50 / max ms | 3.3 / 15.8 | 3.5 / 15.5 | 3.3 / 15.2 | 3.3 / 6.8 | 3.3 / 7.0 | 3.3 / 7.0 | 3.6 / 16.7 |
| panel polls answered during the setup | 65 | 41 | 40 | 31 | 26 | 15 | 11 |
| back lag p99 / max ms (setup) | 95 / 95 | 90 / 90 | 92 / 92 | 93 / 93 | 97 / 97 | 279 / 279 | 189 / 189 |
| back ELU mean (setup) | 0.080 | 0.082 | 0.078 | 0.076 | 0.087 | 0.076 | 0.084 |
| back CPU % of a core, mean / max | 134 / 147 | 139 / 152 | 134 / 147 | 133 / 147 | 132 / 145 | 131 / 144 | 130 / 141 |
| back RSS max MiB (rest → setup) | 296 → 491 | 280 → 485 | 280 → 488 | 279 → 491 | 279 → 512 | 279 → 490 | 278 → 535 |
| back heap max MiB | 102 | 100 | 101 | 99 | 102 | 99 | 99 |
| back threads, rest → setup max (`ps nlwp`) | 12 → 23 | 11 → 24 | 11 → 25 | 11 → 27 | 11 → 25 | 11 → 22 | 11 → 23 |
| 5xx / network errors / timeouts | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| harness saturated in setup | no | no | no | no | no | no | no |

`/organizer/stats/process` follows `/organizer/stats/live` within a few
milliseconds in every run (both are in the raw reports). The harness's own
ELU in `setup` stayed under 0.02 on average (0.13 at most), so these
latencies are the back's (#442).

- **The control matches #136.** C4 gave signup p50 / p95 of 496 / 592 ms,
  the panel 89 / 301 ms, lag p99 95 ms, CPU 134% and 72 s of setup. #136
  measured about 490 / 590 ms, 81–87 / ~300 ms, 87 ms, 134% and 73 s. The
  machine has not drifted.
- **The throughput is fixed at about 8 argon2 operations per second,
  whatever N is.** More requests in flight only lengthen the queue. Signup
  and login latency grow with N (Little's law: 64 in flight at 8/s is 8 s
  each on average), and the setup takes the same ~72 s at every N.
- **Login waits about twice as long as signup at N = 64** (p50 8.7–9.9 s
  against 4.6–5.6 s). Below N = 64 the two stay close.
- **The memory is not the limit.** RSS rose by about 200 MiB during the
  setup at every N: 4 threadpool threads × 64 MiB of argon2, plus the
  extra threads the setup spawns (11–12 at rest, up to 22–27 in setup).
  The 4 GB limit is far away at any N.
- **The event loop is not the limit either.** Its lag stayed at 90–97 ms
  through N = 32 and reached 189–279 ms at N = 64. That is the floor of
  every route, the SSE heartbeat included, but it is 16–32 times less than
  what the panel waited at N = 64.

## Finding: the panel waits behind the argon2 queue

During the peak the organizer's panel answered in 0.7–0.9 s (p50) at
N = 16, 1.5–1.8 s at N = 32 and 4.6–6.0 s at N = 64, against 3 ms at rest.
At N = 64 only 11–15 of the panel's once-per-second polls came back during
a 72 s setup. The back's event-loop lag explains at most 0.3 s of that.

An extra N = 64 run (`N64-probe`, a diagnostic, noisy: another session's
pre-commit ran during it) polled `GET /health` every 0.5 s with `curl`.
`/health` is the one route without authentication. During the setup it
answered in p50 67 ms, p95 82 ms and max 380 ms, while the authenticated
panel, in the same run and the same seconds, took p50 5.7 s and max
7.1 s.

**Inference, not measured directly:** every authenticated route goes
through `requireUser`, kata's `jwtAuth`, which verifies the token with
`hono/jwt`. That uses WebCrypto, and Node runs WebCrypto's HMAC on the same
libuv threadpool as argon2. With the 4 threads busy hashing, each JWT
verification waits in the threadpool's FIFO queue behind every hash
already queued. Teams and joins run after the users, once the queue has
drained, which is why they stayed fast. What this predicts but was not
measured here: the SSE connects (`GET /sse`) and the submissions of
participants already in, during a signup rush, wait just as long. Why login
waits twice as long as signup at N = 64, but not at N = 32, is not
explained by these numbers. Across both, the mean wait does match Little's
law (64 in flight at 8.2/s is 7.8 s).

## Options (not implemented here)

What each option would do, read from these numbers:

1. **A concurrency limit on argon2 in the app**: for example, at most 2–3
   hashes or verifications at a time, below the threadpool's 4 threads, the
   rest queued in the app. One thread always stays free for WebCrypto, so
   the authenticated routes should fall back to the event-loop floor
   (`/health`'s ~70 ms at N = 64) whatever N is. Signup and login would
   keep about the same wait, because the queue moves from libuv into the
   app. The throughput can drop a little with fewer hashes in parallel. The
   inference above has to be confirmed first, for instance by timing a
   JWT verification during the peak. **This is the only option that protects
   the other routes**, so it gets its own issue: #447 (Discovered from
   #436).
2. **`UV_THREADPOOL_SIZE`** (e.g. 8). The back used 130–139% of its 200%
   quota during the setup, so more threads could raise the throughput by at
   most about 1.5×. Every in-flight hash also keeps 64 MiB, so 8 threads
   hold about 512 MiB. But the queue stays FIFO: a JWT still waits behind
   every queued hash, and the panel's wait would shrink only by the
   throughput's gain. On its own, this does not isolate the other routes.
3. **The argon2 parameters.** The work per hash is proportional to m × t.
   OWASP's minimum for argon2id (m = 19 MiB, t = 2, p = 1) is about 5×
   less work than 64 MiB × 3, so about 5× the throughput and every wait
   about 5× shorter at the same N. It also lowers the resistance to offline
   cracking, which makes it a security decision and not a tuning step.
   Existing hashes keep verifying, because each hash carries its own
   parameters.

## Environment

- **The back:** this branch at `685bfa8` (the auth path is the same as
  develop's), under `systemd-run --user --scope -p CPUQuota=200% -p
  MemoryMax=4G -p MemorySwapMax=0`, verified on every scope
  (`CPUQuotaPerSecUSec=2s`, `MemoryMax=4294967296`, `MemorySwapMax=0`).
  Node v24.21.0, default `UV_THREADPOOL_SIZE` (4).
- **Each cycle** followed the protocol of #442's runs
  (`docs/load/442-harness-saturation.md`, Environment). The database was
  reset, the back booted, the harness ran, and the back stopped. The whole
  cycle held `/tmp/kumite-load.lock` and the machine's E2E slot. It waited
  for a 1-minute load under 2 and no `playwright|vitest|lefthook|chrom`
  process, and a `noise.log` recorded the load, that check and the `ps`
  of both processes every 5 s.
- **Noisy runs were redone, up to 2 times.** Five cycles saw another
  session's `vitest` or `lefthook run pre-commit` and were redone; each
  came back clean within the 2 retries. Their raws stay in `436/` for the
  record, and none of them is in the table above.

| run | started (UTC, 2026-10-07) | harness load average (1/5/15 min), start → end | noise |
|---|---|---|---|
| C4 | 00:54 | 1.71 / 2.05 / 2.58 → 0.39 / 1.47 / 2.31 | clean |
| N16a | 00:56 | 0.55 / 1.47 / 2.30 → 1.60 / 1.37 / 2.16 | clean |
| N16b (1st, 2nd) | 00:58, 01:20 | — | noisy: `lefthook run pre-commit`, then `vitest run` |
| N16b | 01:24 | 1.85 / 3.00 / 2.84 → 2.75 / 3.18 / 2.93 | clean (3rd try) |
| N32a (1st) | 01:00 | — | noisy: `vitest`, `lefthook run pre-commit` |
| N32a | 01:26 | 1.54 / 2.81 / 2.82 → 0.56 / 2.05 / 2.54 | clean (2nd try) |
| N32b (1st) | 01:03 | — | noisy: `vitest`, `lefthook run pre-commit` |
| N32b | 01:28 | 0.59 / 2.03 / 2.53 → 4.52 / 2.55 / 2.63 | clean (2nd try) |
| N64a (1st) | 01:07 | — | noisy: `vitest`, `lefthook run pre-commit` |
| N64a | 01:31 | 1.80 / 2.12 / 2.48 → 6.05 / 3.09 / 2.76 | clean (2nd try) |
| N64b | 01:11 | 1.55 / 2.80 / 2.61 → 2.61 / 2.96 / 2.70 | clean |
| N64-probe | 01:15 | 1.47 / 2.53 / 2.57 → 3.63 / 2.68 / 2.60 | noisy (`lefthook run pre-commit`); diagnostic only, its own numbers match N64a/b |

Pending: confirmation on the VPS (#139).
