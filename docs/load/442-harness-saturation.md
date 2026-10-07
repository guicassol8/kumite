# The harness measured itself (#442)

#439 made the back's fan-out cheap: every `ranking.updated` became one
encoded frame shared by the 400 streams. The bottleneck then moved to the
load harness. It parsed and validated that same 90–130 KB text once per
connection, 400 times per emission, in one Node process. The harness sat at
100% of one core through the burst's `load` phase. Its back polls arrived
15–46 s apart, and the heartbeat gaps it reported measured the harness, not
the back (`docs/load/439-sse-fanout.md` on the #439 branch).

This change does two things:

- **Each distinct payload is validated once per run.** A cache shared by the
  run's streams is keyed by the `data:` text (`createPayloadCache` in
  `back/src/load/sse-client.ts`).
- **The harness reports its own load.** It records CPU, event-loop
  utilization (ELU) and event-loop delay per phase (`harness-sampler.ts`),
  and the report gets a `## Phases (harness process)` table. A phase with a
  mean ELU ≥ 0.9 or a stall ≥ 1000 ms gets a warning. That warning never
  fails the run.

All runs are local. The raw reports, `noise.log`, the harness's `top` and
the profile summaries are in [`442/`](442/).

## Verdict

- **Acceptance 1 (the harness below one saturated core in R8's `load`, or
  the report says it saturated): PASS by the first branch.** In R8b the
  harness used 10.7% of a core on average in `load` (21% max), with an ELU
  of 0.059 and no `harness saturated` warning. R8a, which ran under the CPU
  profiler, used 19.9%. Before the fix, the same run kept the harness at
  97–104% of a core.
- **Acceptance 2 (invalid payloads and settle/storm consistency still
  detected): PASS.** R8a, R8b and R10 have 0 invalid payloads. Settle and
  the storm each report "400 compared, 1 distinct digest(s): matches the
  API". The new tests prove that the shared cache still counts an invalid
  payload on every connection that receives it, and still keeps each
  connection's own last digest (`sse-client.test.ts`). They also prove that
  the in-process mini burst still ends with one digest that matches the API
  (`scenarios.test.ts`).
- **The back's numbers are readable again.** The largest heartbeat gap per
  connection dropped from 14–29 s to 1.07–1.42 s, which is the back's 1 s
  heartbeat plus its own stalls. The back is polled every 1.1 s instead of
  every 25–49 s.

No run saturated the harness after the fix, so no "Discovered from #442"
issue for `worker_threads` was needed.

## What the harness spent its time on

These are the CPU profiles (`--cpu-prof`) of the harness's process, with
self time summed over the `load` phase. V8 attributes a builtin to the JS
function that calls it. So `JSON.parse` and `Buffer.byteLength` show up as
the self time of the SSE client's frame callback, and `JSON.stringify` as
the self time of `canonicalJson`'s replacer.

| category | before (R0p), self s | % of busy | after (R8a), self s | % of busy |
|---|---|---|---|---|
| zod (`SseEventSchema` + the two ranking schemas) | 45.63 | 43.0 | 0.11 | 2.8 |
| ranking digest (`canonicalJson` + its `JSON.stringify`) | 39.41 | 37.1 | 0.11 | 2.8 |
| SSE client callback (`JSON.parse`, `Buffer.byteLength`) | 9.32 | 8.8 | 0.29 | 7.6 |
| sha256 (`node:crypto`) | 2.83 | 2.7 | 0.01 | 0.1 |
| garbage collector | 2.91 | 2.7 | 0.69 | 18.2 |
| SSE parser (`push`, `dispatch`, their string builtins) | 1.59 | 1.5 | 0.34 | 8.9 |
| undici | 0.99 | 0.9 | 0.59 | 15.5 |
| `TextDecoder.decode` | 0.17 | 0.2 | 0.11 | 3.0 |
| everything else (node internals, program, other) | 3.25 | 3.1 | 1.55 | 41.0 |
| **busy, of the phase** | **106.1 s of 109.2 s (97%)** | | **3.8 s of 70.5 s (5%)** | |

- **The plan's premise held.** Parsing, zod and the digest took 92% of the
  busy time (zod 43.0, the digest 37.1 + 2.7, the parse callback 8.8), well
  over the 50% the cache design needed.
- **The parser was not worth changing.** `push`, `dispatch` and their
  `RegExp`/`indexOf` took 1.5%, under the plan's 5% bar, so step T3 (a
  parser linear in the frame's size) was skipped. After the fix the parser
  is 0.34 s over a 70 s phase.
- **The cache served 97% of the payloads.** In R8b, 1,651 distinct payloads
  were validated and 57,501 frames were answered from the cache.

## Before × after

The back is the same in every run (see Environment). "Before" is the
harness at `3c8f3d0`, and "after" is the harness at `685bfa8`. The phase is
`load`.

| | R0 | **R0-2 (control)** | R0p | R8a | **R8b** | R10 |
|---|---|---|---|---|---|---|
| run | R8, before | R8, before | R8, before, profiled | R8, after, profiled | R8, after | R10, after |
| noise | **noisy** | clean | clean | clean | clean | clean |
| `load` duration s | 116.2 | 77.2 | 110.7 | 71.3 | 71.4 | 69.3 |
| harness CPU % of a core, mean / max (`top`, 1 s) | 93.5 / 113 | 97.2 / 114 | 104.0 / 121 | 19.8 / 44 | 10.7 / 22 | 12.0 / 27 |
| harness CPU % mean / max (its own sampler) | — | — | — | 19.9 / 33.3 | 10.7 / 21.2 | 12.2 / 28.9 |
| harness ELU mean / max | — | — | — | 0.672 / 0.695 ¹ | 0.059 / 0.098 | 0.075 / 0.151 |
| harness lag p99 / max ms | — | — | — | 24.5 / 58.8 | 24.0 / 37.6 | 46.1 / 95.9 |
| largest gap between two back polls | 49.3 s | 24.8 s | 35.4 s | 1.08 s | 1.14 s | 1.10 s |
| back samples in the phase | 19 | 22 | 11 | 70 | 70 | 68 |
| largest heartbeat gap per connection, p50 / p95 / max s | 25.3 / 27.4 / 28.8 | 7.7 / 12.3 / 14.3 | 20.4 / 21.9 / 30.0 | 1.20 / 1.20 / 1.20 | 1.42 / 1.42 / 1.42 | 1.07 / 1.07 / 1.07 |
| correct submission p50 s | 23.3 | 18.5 | 28.4 | 16.1 | 15.6 | 15.3 |
| back lag p99 ms | 223.4 | 99.3 | 192.6 | 88.4 | 91.2 | 94.6 |
| payloads validated, distinct / reused | — | — | — | 1,672 / 57,592 | 1,651 / 57,501 | 1,653 / 56,593 |
| `harness saturated` warnings | — | — | — | none | none | none |
| invalid payloads | 0 | 0 | 0 | 0 | 0 | 0 |
| settle and storm | 1 digest, matches the API | same | same | same | same | same |
| `ranking.updated` max bytes | 91,769 | 91,723 | 91,862 | 91,630 | 91,642 | 130,545 |
| verdict | PASS | PASS | PASS | PASS | PASS | PASS |

¹ The CPU profiler inflates the ELU reading. With `--cpu-prof`, R8a's
harness read an ELU of 0.66 even at `rest`, where it used 10% of a core.
Without the profiler, R8b read 0.004 at `rest`. Use R8a for its profile and
its CPU, not for its ELU.

- **The harness used to set the pace of the run.** Before the fix the
  `load` phase lasted 77–116 s, and after it 69–71 s. The submissions are
  scheduled on the harness's own event loop, so a saturated loop sent them
  late.
- **The correct submission got faster by a few seconds** (p50 18.5 s in the
  clean control, 15.3–16.1 s after). Part of the old number was the
  harness's own delay in reading the response.
- **The back's lag p99 in `load` was 88–95 ms after the fix**, and 99 ms in
  the clean control. These runs use the back of #439 on top of the current
  develop (#438's keep-alive included). #439's own report measured 175–185
  ms on that branch. That is an observation for #439's open decision about
  its lag acceptance, not part of this issue.
- **Where the heartbeat gaps measure the back.** Only in a phase that
  `## Phases (harness process)` does not mark as saturated. All the "after"
  runs qualify.

## Environment

- **The back:** `origin/develop` at `3c8f3d0` plus `back/src/modules/sse/`
  from `task/439-fanout-sse-frame-unico` at `d346f1e`, in a detached
  measurement worktree that was never committed. The develop branch has not
  changed `back/src/modules/sse/` since `a9beaf8`, so this is develop (with
  #438's keep-alive) plus #439's back. A `curl -si /health` before each run
  returned `Keep-Alive: timeout=130`.
- **The limits:** the back ran under `systemd-run --user --scope -p
  CPUQuota=200% -p MemoryMax=4G -p MemorySwapMax=0`, and `systemctl --user
  show` on each run's scope confirmed `CPUQuotaPerSecUSec=2s`,
  `MemoryMax=4294967296` and `MemorySwapMax=0`. The judge ran at the
  default `JUDGE_CONCURRENCY` of 4, with a 2000 ms timeout and 64 MB.
- **The harness:** "before" ran from the measurement worktree (`3c8f3d0`)
  and "after" from this branch (`685bfa8`), both against the same back
  with `--url`. The report's `commit` is the harness's HEAD. After the
  measurements the branch was rebased onto develop's `5652903`, a
  front-only change, so the same harness code is now `b78a295`.
- **Each cycle** reset the database (`pnpm worktree:env --reset`), booted
  the back, ran the harness and stopped the back. The whole cycle held
  `flock /tmp/kumite-load.lock` and the machine's E2E slot
  (`/tmp/kumite-e2e-slot-1.lock`), so no other measurement and no `pnpm
  e2e` could overlap it.
- **Before each cycle**, the 1-minute load average had to be under 2, and
  `pgrep -fa 'playwright|vitest|lefthook|chrom'` had to return nothing.
  During the cycle a loop wrote to `noise.log` every 5 s: the load average,
  that `pgrep`, and the `ps` of the harness and the back.
- **The machine:** 12 logical CPUs, 7.7 GiB RAM, WSL2, Node v24.21.0.

| run | started (UTC) | harness load average (1/5/15 min), start → end | concurrent processes in `noise.log` |
|---|---|---|---|
| R0 | 00:03 | 1.52 / 0.65 / 0.33 → 8.14 / 3.78 / 1.59 | another session's `vitest` and `lefthook run pre-commit`: **noisy**, redone as R0-2 |
| R0p | 00:13 | 1.61 / 3.03 / 1.96 → 3.32 / 3.15 / 2.22 | none |
| R0-2 | 00:39 | 1.73 / 3.47 / 3.61 → 2.73 / 2.77 / 3.27 | none |
| R8a | 00:43 | 1.88 / 2.57 / 3.18 → 2.79 / 2.54 / 3.04 | none |
| R8b | 00:46 | 1.67 / 2.27 / 2.93 → 2.04 / 2.35 / 2.83 | none |
| R10 | 00:50 | 1.73 / 2.27 / 2.80 → 2.48 / 2.21 / 2.64 | none |

All the runs are on 2026-10-07. The R0 numbers stay in the table for the
record, but the noisy run is not a basis for any acceptance. R0-2 is the
control.

## Acceptance (#442)

| acceptance | run | measured | result |
|---|---|---|---|
| the harness below one saturated core in `load`, or the report says it saturated | R8a, R8b | CPU 19.9% (profiled) and 10.7% of a core, ELU 0.059 (R8b), lag max 59 / 38 ms, no warning | PASS |
| invalid payloads still detected | R8a, R8b, R10 + tests | 0 in every run, and an invalid payload is counted on every connection (`sse-client.test.ts`) | PASS |
| settle and storm consistency still detected | R8a, R8b, R10 + tests | 1 distinct digest, matches the API, at settle and after the storm | PASS |

Pending: confirmation on the VPS (#139), where the harness runs on a
different machine from the back.
