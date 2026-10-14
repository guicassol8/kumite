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

There are two rounds of measurements:

- **2026-10-05, the first round:** R0 (the control) and R8–R10 on the
  branch, with the harness of the time. The lag acceptance failed, and the
  implementation stopped there. That round is kept below, as measured.
- **2026-10-14, after #442:** the same runs on the branch merged with
  develop. In the first round the harness sat at 100% of a core during
  `load`, because it validated every frame of all 400 streams. #442 made it
  validate each distinct payload once, and since then it measures the back
  and not itself (`docs/load/442-harness-saturation.md`).

## Re-measurement on develop, after #442 (2026-10-14)

### Verdict

**R8 meets every acceptance. The user accepted the result on the reading
below; confirmation on the VPS stays in #139.**

- R8, the run each acceptance is read on, passes all of them.
- The repeat R8b missed the publish p95 bar: 64.5 ms. R9, which is not an
  acceptance run, gave 61.3 ms.
- Every publish took either 1.3–4.7 ms or 58–78 ms, nothing in between.
- During R8c's `load`, 92% of the CFS periods were throttled. The likely
  cause of the slow group is therefore the 2-CPU quota of the local setup,
  not the fan-out ("The 60 ms stalls" below).
- On the VPS (#139) there is no CFS quota: an R8 and an R8b there confirm
  the publish p95.

- **Acceptance 1, event-loop lag p99 under 150 ms in R8's `load`: PASS.**
  90 ms, and 92 and 93 ms in the repeats R8b and R8c. The 175–185 ms of the
  first round does not come back.
- **Acceptance 1, publish p95 under 50 ms in R8: PASS in R8, not in every
  repeat.**
  - R8 and R8c: 2.8 ms.
  - R8b: **64.5 ms**.
  - The emissions split in two groups, with nothing between them:
    1.3–4.7 ms, or 58–78 ms. With about 63 emissions, four in the slow
    group are enough to put the p95 over 50 ms. R8 had 2, R8b had 6, R8c
    had 2.
  - The slow group comes from the CPU quota parking the whole process, not
    from the fan-out. That is inferred from the cgroup's throttling
    counters ("The 60 ms stalls" below).
- **Acceptance 2, RSS max under 1024 MiB in R10: PASS.** 722 MiB, in
  `teardown`; 640 MiB in `load`.
- **Acceptance 3, one ranking on every connection, equal to the API's, at
  settle and after the storm: PASS.** R8, R8b, R8c, R9 and R10 all report
  "1 distinct digest(s): matches the API".
- **The harness verdict is PASS in every run.** There are no network errors
  now that develop carries #438's keep-alive, no SSE dropped and no invalid
  payload. No phase was marked `harness saturated`: the harness used 8–12%
  of a core in `load`.

### Environment

- **The code:** `a5050fc`, the branch at `d346f1e` merged with
  `origin/develop` at `9232995`. That develop includes #438's keep-alive
  (`Keep-Alive: timeout=130` on `/health` before each run) and #442's
  harness. The back's SSE code is the same as in the first round.
- **Merged afterwards:** #443 (#277, `e46a7d1`, the judge's pool of warm
  workers) landed on develop after these runs, and the branch was merged
  with it before the PR. It changes how the judge spawns its workers, so
  the absolute judge numbers (correct-submission latency, CPU in `load`,
  maybe the throttling) would differ on today's develop. The SSE fan-out
  code is unaffected. The runs were not repeated.
- **The limits:** the same as the first round and #138. The back ran under
  `systemd-run --user --scope -p CPUQuota=200% -p MemoryMax=4G -p
  MemorySwapMax=0`. `systemctl --user show` on each scope confirmed
  `CPUQuotaPerSecUSec=2s`, `MemoryMax=4294967296` and `MemorySwapMax=0`. The
  back used `JUDGE_CONCURRENCY=4`.
- **Each cycle:**
  - reset the database (`pnpm worktree:env --reset`), booted the back, ran
    the harness and stopped the back;
  - held `flock /tmp/kumite-load.lock` and the machine's E2E slot
    (`/tmp/kumite-e2e-slot-1.lock`) from start to finish;
  - started only with the 1-minute load average under 1.0 and no
    `playwright|vitest|lefthook|chrom` process running;
  - sampled that `pgrep` every 5 s while it ran.
- **The machine:** 12 logical CPUs, 7.7 GiB RAM, WSL2, Node v24.21.0.

| run | flags | started (UTC) | harness load average (1/5/15 min), start → end | another session's process during the cycle |
|---|---|---|---|---|
| R8 | `--bad-fraction 0.1` | 17:57 | 0.95 / 1.99 / 1.95 → 1.85 / 2.13 / 2.03 | none (0 of 37 samples) |
| R8b | R8 again | 18:05 | 0.88 / 1.61 / 1.83 → 2.41 / 1.97 / 1.92 | none (0 of 37) |
| R9 | `--bad-fraction 0.3 --storm-window 2` | 18:12 | 0.92 / 1.59 / 1.77 → 2.60 / 2.35 / 2.06 | none (0 of 51) |
| R10 | `--bad-fraction 0.1 --past-rounds 3` | 18:20 | 0.93 / 2.00 / 2.00 → 2.50 / 2.53 / 2.22 | none (0 of 45) |
| R8c | R8 again, with the scope's `cpu.stat` sampled every 100 ms | 18:27 | 0.85 / 2.06 / 2.12 → 2.26 / 2.49 / 2.30 | another worktree's `lefthook` (8 of 37) |

R8c ran mainly to read the cgroup's throttling counters. A pre-commit from
another session overlapped it in part. Its numbers agree with R8's, but it
is not a basis for any acceptance.

### Before × after

"Before" is #138's R8–R10 (`ed48fe6`). "First round" is this branch's
2026-10-05 run (`ef2964c`). The phase is `load` unless a row says otherwise.

| | R8 #138 | R8 first round | **R8** | **R8b** | **R8c** | R9 #138 | R9 first round | **R9** | R10 #138 | R10 first round | **R10** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ranking publish ms, p50 / p95 / max | 133 / 294 / 377 | 2.5 / 11.6 / 60.7 | **1.6 / 2.8 / 65.0** | **1.6 / 64.5 / 68.5** | **1.7 / 2.8 / 64.7** | 196 / 277 / 364 | 2.1 / 4.6 / 67.4 | **1.6 / 61.3 / 69.6** | 271 / 486 / 498 | 2.3 / 66.7 / 82.7 | **1.9 / 4.7 / 78.0** |
| ranking emissions in `load`, of them over 50 ms | — | — | 61, 2 | 63, 6 | 63, 2 | — | — | 89, 11 | — | — | 63, 3 |
| event-loop lag p99 ms | 502 | 185 | **90** | **92** | **93** | 562 | 101 | **89** | 692 | 164 | **165** |
| RSS max MiB, any phase | 669 | 607 | **621** | **565** | **629** | 677 | 625 | **548** | 1,995 | 644 | **722** |
| heap max MiB, any phase | 195 | 285 | 145 | 275 | 213 | 279 | 203 | 147 | 711 | 285 | 211 |
| largest heartbeat gap per connection, p50 / max | 4.9 / 9.4 s | 10.6 / 14.2 s | 1.39 / 1.39 s | 1.02 / 1.07 s | 1.50 / 1.50 s | 10.1 / 18.8 s | 12.7 / 23.9 s | 1.40 / 1.41 s | 11.3 / 20.8 s | 6.2 / 12.4 s | 1.09 / 1.09 s |
| correct submission p50 | 18.0 s | 21.6 s | 15.2 s | 15.2 s | 15.6 s | 43.8 s | 44.2 s | 36.8 s | 25.9 s | 21.2 s | 15.3 s |
| `ranking.updated` max bytes | 91,654 | 91,749 | 91,643 | 91,607 | 91,646 | — | 91,536 | 91,530 | 130,715 | 130,647 | 130,541 |
| harness verdict | FAIL (#438) | FAIL (#438) | PASS | PASS | PASS | FAIL (#438) | FAIL (#438) | PASS | FAIL (#438) | FAIL (#438) | PASS |

- **The back is back to its no-SSE numbers.** Without SSE (#137), R2's
  correct submission had a p50 of 15.0 s and R3's of 37.4 s. With 400
  streams, R8 now gives 15.2 s and R9 36.8 s. In #138 the same runs gave
  18.0 s and 43.8 s.
- **The heartbeat gap measures the back again.** It is 1.0–1.5 s, the 1 s
  heartbeat plus the back's own stalls. In the first round it was 6–24 s,
  but the saturated harness made those gaps, as #442 showed.
- **The heap max is in the storm.** It reaches 211–275 MiB when the 400
  snapshots are built at once. That path is unchanged here (plan, user
  decision 2).

### The 60 ms stalls

Per one-second window of the `load` phase:

| run | windows | window p99, p50 / p90 / p95 | the largest windows |
|---|---|---|---|
| #137 R2 (no SSE) | 68 | 62 / 70 / 71 | 71 79 79 80 |
| R8 | 69 | 69 / 78 / 81 | 81 83 90 90 |
| R8b | 69 | 68 / 79 / 80 | 80 81 91 92 |
| R8c | 69 | 68 / 78 / 83 | 84 85 90 93 |
| R9 | 139 | 63 / 73 / 78 | 82 83 89 91 |
| R10 | 69 | 72 / 81 / 85 | 86 92 98 165 |

- **The typical window is the same as with no SSE at all.** That holds in
  every run: 63–72 ms, against 62 ms in #137's R2.
- **In R8, R8b and R8c, no window goes past 93 ms.**
- **R10 still has one window of 165 ms**, like its first round (164 ms).
  The emission that ended inside it published in 1.7 ms. R10's acceptance
  is the RSS, not the lag.

The stalls of about 60 ms are the CPU quota. R8c read the back scope's
`cpu.stat` every 100 ms during `load` (69.8 s):

- **The cgroup was throttled in almost every period.** 644 of 698 periods
  (92%) were throttled. During `rest` and `setup` it was 14 of 304.
- **It used its whole quota.** It used 1.94 CPUs, against a quota of 2.
- **The throttled time is large.** `throttled_usec` grew by 223.5 s. That
  counter adds up the time across the CPUs (run queues), so it comes to
  347 ms per throttled period.

What follows is an inference from those numbers, not a measurement of each
thread:

- **Five threads share the quota.** The judge's four workers and the main
  thread run in the same cgroup, and during `load` all five are busy.
- **The quota runs out early in each period.** Together the five threads
  use the 200 ms of quota of a 100 ms period in about 40 ms.
- **Then the whole cgroup is parked.** Every thread, the event loop
  included, waits for the next period, about 60 ms later.

The data agree with that inference:

- **The emissions fall into two groups.** A publish is a synchronous block
  of 1.3–4.7 ms. It either gets through between two stalls or catches one
  and pays about 60 ms more. In five runs, no ranking publish took between
  5 and 58 ms.
- **The typical lag window is that same stall.** A window's p99 sits at
  63–72 ms, which is the length of one stall.
- **The no-SSE floor of #137 is that same stall.** It was 62 ms.

So the publish p95 crosses 50 ms when enough of the emissions catch a
stall. That is a matter of timing under this quota, not a cost of the
fan-out. The fan-out itself costs 1.6–1.9 ms at the p50.

On the VPS, two real CPUs replace the CFS quota. The five threads then
share the cores through the ordinary scheduler's time slices, not 60 ms
parks, so the outliers should shrink or vanish. Only the VPS run (#139)
can confirm this.

### Acceptance (#439)

| acceptance | run | measured | result |
|---|---|---|---|
| publish p95 < 50 ms (Emissions, `load`, ranking) | R8 | 2.8 ms (R8c: 2.8 ms; **R8b: 64.5 ms**) | PASS in R8; R8b over the bar, from the CPU quota |
| lag p99 < 150 ms (Phases, `load`) | R8 | 90 ms (R8b: 92 ms; R8c: 93 ms) | PASS |
| RSS max < 1024 MiB in every phase | R10 | 722 MiB | PASS |
| 1 distinct digest, matches the API, at settle and after the storm | R8, R9, R10 | yes in all, R8b and R8c included | PASS |

Pending: confirmation on the VPS (#139).

## First round, before #442 (2026-10-05)

Kept as measured. Its harness was saturated during `load` (#442), so its
heartbeat gaps and its correct-submission latencies measured the harness as
much as the back.

### Verdict

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

### Environment

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

### Before × after

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

### The lag that fails

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
  measures which. The second round read the cgroup's throttling counters
  ("The 60 ms stalls" above). The R8 runs of that round no longer show a
  window past 93 ms.

### Acceptance (#439), first round

| acceptance | run | measured | result |
|---|---|---|---|
| publish p95 < 50 ms (Emissions, `load`, ranking) | R8 | 11.6 ms (R8b: 3.9 ms) | PASS |
| lag p99 < 150 ms (Phases, `load`) | R8 | 185 ms (R8b: 175 ms) | **FAIL** |
| RSS max < 1024 MiB in every phase | R10 | 644 MiB | PASS |
| 1 distinct digest, matches the API, at settle and after the storm | R8, R9, R10 | yes in all, R8b included | PASS |

Pending: confirmation on the VPS (#139).
