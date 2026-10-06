# One SSE frame per emission (#439)

#138 measured the fan-out of `ranking.updated` to 400 connections at
130–600 ms per emission (`docs/load/138-sse-fanout.md`). Each connection paid
for its own `JSON.stringify` of a 90–130 KB ranking, inside the synchronous
`bus.publish`, and then for hono's `writeSSE` splitting and re-encoding that
string into a `Uint8Array` of its own, queued per stream. The event loop
stalled and RSS reached about 2 GB with past rounds.

#439 encodes the frame **once per event** (`encodeSseFrame` in
`back/src/modules/sse/sse.service.ts`, memoized per event object) and every
connection writes that same `Uint8Array` with `stream.write`. The bytes on
the wire are identical to what `writeSSE` produced: the tests compare them
against hono's real `SSEStreamingApi`.

All the runs are local. **Pending: confirmation on the VPS (#139).** The raw
reports are in [`439/`](439/).

## Verdict

- **Acceptance 1, publish p95 under 50 ms in R8: PASS.** 11.6 ms, and
  3.9 ms in the rerun, down from 294 ms.
- **Acceptance 1, event-loop lag p99 under 150 ms in R8's `load` phase:
  FAIL.** 185 ms, and 175 ms in the rerun, down from 502 ms. In both runs a
  single one-second window passes 150 ms; the rest stay under 106 ms. The
  outlier windows do not line up with an expensive emission (below).
- **Acceptance 2, RSS max under 1024 MiB in R10: PASS.** 644 MiB, down from
  1,995 MiB.
- **Acceptance 3, every connection on the same ranking as the API in R8, R9
  and R10: PASS.** "1 distinct digest(s): matches the API" at settle and
  after the storm, in every run.

Per the plan, a failed acceptance stops the implementation: the numbers go
to the issue for a decision, and nothing else (slicing the fan-out, trimming
the payload) was improvised.

The harness verdict is FAIL in every run for the reason #138 already
documented: `UND_ERR_SOCKET · request · reused` network errors, the
keep-alive race of #438, which is not on this branch. In R10 the same error
also hit two of the harness's own stats polls, as #138 noted. No SSE
connection dropped or carried an invalid payload, and the back answered no
5xx.

## Environment

The same as #138:

- the back under `systemd-run --user --scope` with `CPUQuota=200%`,
  `MemoryMax=4G` and `MemorySwapMax=0`, verified on every scope;
- `JUDGE_CONCURRENCY=4`;
- the database reset (`pnpm worktree:env --reset`) and the back restarted
  before every run;
- the whole cycle (reset, back boot, harness, stop) held under the
  machine-wide `flock /tmp/kumite-load.lock`, because other worktrees ran
  their own measurements at the same time.

| # | run | commit | harness load average (1/5/15 min), start → end |
|---|---|---|---|
| R0 | control: R8 on the base commit, before any change | `a9beaf8` | 4.11 / 3.77 / 2.63 → 4.88 / 4.67 / 3.27 |
| R8 | `pnpm load:burst --bad-fraction 0.1` | `ef2964c` | 0.86 / 2.90 / 3.05 → 3.37 / 3.12 / 3.08 |
| R8b | R8 again, to see the variance of the lag | `ef2964c` | 0.81 / 1.25 / 1.68 → 3.53 / 2.09 / 1.88 |
| R9 | `pnpm load:burst --bad-fraction 0.3 --storm-window 2` | `ef2964c` | 0.76 / 1.74 / 2.44 → 2.32 / 2.13 / 2.41 |
| R10 | `pnpm load:burst --bad-fraction 0.1 --past-rounds 3` | `ef2964c` | 0.89 / 1.40 / 1.99 → 1.72 / 1.73 / 1.97 |

- **The control ran on a busy machine.** Other agents' gates kept the load
  average above 1.0 for the 20 minutes the cycle waited, so it ran at 2.8.
  Its numbers are still in the order of #138's R8 (publish p50 208 ms, lag
  p99 793 ms), which is what the control is for: the base commit's back is
  the code #138 measured.
- `ef2964c` differs from `a9beaf8` only in `back/src/modules/sse/` and in
  the text of two harness notes.

## Before × after

"Before" is #138's run (R8–R10 at `ed48fe6`, the same back code as
`a9beaf8`) and, for R8, the control R0.

| | R8 #138 | R0 control | **R8** | **R8b** | R9 #138 | **R9** | R10 #138 | **R10** |
|---|---|---|---|---|---|---|---|---|
| ranking publish ms, p50 / p95 / max (`load`) | 133 / 294 / 377 | 208 / 398 / 413 | **2.5 / 11.6 / 60.7** | **2.4 / 3.9 / 81.2** | 196 / 277 / 364 | **2.1 / 4.6 / 67.4** | 271 / 486 / 498 | **2.3 / 66.7 / 82.7** |
| event-loop lag p99 ms (`load`) | 502 | 793 | **185** | **175** | 562 | **101** | 692 | **164** |
| RSS max MiB, any phase | 669 | 700 | **607** | **615** | 677 | **625** | 1,995 | **644** |
| heap max MiB, any phase | 195 | 173 | 285 | 272 | 279 | 203 | 711 | 285 |
| largest heartbeat gap per connection, p50 / max | 4.9 / 9.4 s | 11.9 / 22.1 s | 10.6 / 14.2 s | 11.6 / 19.7 s | 10.1 / 18.8 s | 12.7 / 23.9 s | 11.3 / 20.8 s | 6.2 / 12.4 s |
| correct submission p50 | 18.0 s | 22.5 s | 21.6 s | 23.3 s | 43.8 s | 44.2 s | 25.9 s | 21.2 s |
| `ranking.updated` max bytes | 91,654 | 91,754 | 91,749 | 91,740 | — | 91,536 | 130,715 | 130,647 |

- **The publish dropped by two orders of magnitude.** Its p50 is now about
  2 ms with 400 subscribers: one stringify and one encode, then 400 queued
  writes of the same buffer. The p95/max outliers (60–80 ms) are not the
  fan-out's own cost, see the lag below.
- **The memory no longer scales with the connections.** R10's RSS went from
  1,995 to 644 MiB. Every queue now points at the same buffer.
- **The heap max moved up in the storm, not in the load.** It is 272–285 MiB
  in the `storm` phase of R8, R8b and R10, the 400 snapshots being built at
  once. The snapshot path is unchanged here (plan, user decision 2).
- **The heartbeat gap is not a measurement of the back any more.** It is
  measured by the harness, and the harness was at 100% of one core through
  the `load` phase (sampled with `top` during R10): it parses and validates
  with zod every frame on all 400 connections, 30–50 MB/s of JSON, in one
  process. Its own stats polls arrived up to 15–46 s apart in the same runs.
  Before #439 the back was the slower side, so the gaps measured the back;
  now the gaps measure the harness. Discovered as #442.
- **The correct submission's latency did not improve.** The judge is CPU
  bound under the 2-CPU quota (back CPU mean 166–193% in `load`), and the
  harness itself is saturated, so this number is not a clean signal either.

## The lag that fails

Per one-second window of the `load` phase (the report's "lag p99" is the
99th percentile of these windows' p99, which over 88–147 windows is the
largest or the second largest):

| run | windows | window p99, p50 / p90 / p95 | the largest windows |
|---|---|---|---|
| #137 R2 (no SSE) | 68 | 62 / 70 / 71 | 71 79 79 80 |
| #138 R8 | 65 | 227 / 402 / 416 | 416 476 501 502 |
| R0 control | 98 | 258 / 522 / 730 | 777 785 793 |
| R8 | 88 | 68 / 92 / 94 | 96 104 180 185 |
| R8b | 94 | 71 / 95 / 98 | 99 102 106 175 |
| R9 | 147 | 65 / 90 / 94 | 99 100 101 124 |
| R10 | 95 | 68 / 95 / 102 | 102 103 104 164 |

- **The typical window is back near the no-SSE floor.** The median window
  is 65–71 ms, against 62 ms for #137's R2 with no SSE at all. That floor is
  the judge's four workers and the main thread sharing a 200% CPU quota.
- **One window per run passes 150 ms**, and only in R8, R8b and R10.
- **The outliers are not the fan-out.** In each of them the emissions that
  ended within the window published in 2–12 ms (R8: 3.9, 11.6 and 2.4 ms;
  R8b: 3.2, 3.5 and 3.5 ms; R10: 2.0, 2.1 and 2.1 ms). What stalled the loop
  for 160–185 ms is something else in the process, GC or the CPU quota
  throttling the whole cgroup being the likely candidates. Nothing here
  measures which.

## Acceptance (#439)

| acceptance | run | measured | result |
|---|---|---|---|
| publish p95 < 50 ms (Emissions, `load`, ranking) | R8 | 11.6 ms (R8b: 3.9 ms) | PASS |
| lag p99 < 150 ms (Phases, `load`) | R8 | 185 ms (R8b: 175 ms) | **FAIL** |
| RSS max < 1024 MiB in every phase | R10 | 644 MiB | PASS |
| 1 distinct digest, matches the API, at settle and after the storm | R8, R9, R10 | yes in all, R8b included | PASS |

Pending: confirmation on the VPS (#139).
