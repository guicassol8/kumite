# Judge with a warm worker pool (#277)

Before and after measurement of the warm worker pool, using the load
harness's `burst` scenario (`back/src/load/`, see its `README.md`), with the
same runs #137 used (`docs/load/137-judge-burst.md`). A worker whose
submission ended clean now goes back to an idle list, and the next
submission reuses it instead of starting a worker thread and loading
QuickJS's WASM again. The design is in ADR-0001's Amendment (#277).

The raw reports (`report.md` and `report.json` per run) are in
[`277/`](277/): `before-*` were taken on `a9beaf8` (`develop` before this
branch), `after-*` on `c443ec8` (this branch's two code commits on top of
`a9beaf8`). The branch was rebased afterwards onto #441 (keep-alive
timeouts of the back's HTTP server, `main.ts` and `Caddyfile`), which no run
here includes; it does not touch the judge.

All the runs are local. **Pending: confirmation on the VPS (#139).**

## Environment

| | |
|---|---|
| Machine | WSL2 (Linux 6.18) on 12 logical CPUs, 7.7 GiB RAM |
| Back | `tsx src/main.ts` on Node 24.21.0 |
| Limiter | `systemd-run --user --scope -p CPUQuota=200% -p MemoryMax=4G -p MemorySwapMax=0`. `systemctl --user show` on every run's scope confirmed `CPUQuotaPerSecUSec=2s`, `MemoryMax=4294967296` and `MemorySwapMax=0` |
| Judge | `JUDGE_CONCURRENCY=4`, `JUDGE_TIMEOUT_MS=2000`, `JUDGE_MEMORY_MB=64` (the report's judge section confirms them) |
| Database | the native Postgres on the same machine (port 5487), outside the limiter and shared with every other worktree |

Every run was one cycle under the machine-wide lock
(`flock /tmp/kumite-load.lock`), from the reset to the back's stop:

- `pnpm worktree:env --reset`;
- `node scripts/build-sandbox-worker.mjs`;
- the back started under the limiter;
- a wait for a 1-minute load average under 1.0 with no vitest, Playwright
  or lefthook process (up to 15 min before the lock and 3 min inside it);
- the harness;
- the back stopped.

Other worktrees were measuring and testing at the same time, so the before
and after runs are interleaved with theirs, and the load average varies. It
is in the table below, as the harness saw it at its start and end.

| run | command |
|---|---|
| R0 | `pnpm load:burst --teams 1 --members 1 --sse 0 --submissions 12 --bad-fraction 0 --problems 1` |
| R1, R1b | `pnpm load:burst --sse 0 --bad-fraction 0` |
| R2, R2x | `pnpm load:burst --sse 0 --bad-fraction 0.1` |
| R3, R3x | `pnpm load:burst --sse 0 --bad-fraction 0.3` |

R1b repeats R1, as the plan asked. R2x and R3x repeat R2 and R3, before
and after, because the first R2 and R3 after the change were hit by a stall
outside the back (below).

## Before and after

Correct submission: `POST /submissions` latency until the 201's last byte,
p50 / p95 / max, in seconds. Load: the duration of the load phase, which
ends with the last submission. Queue, spawn and exec are the back's own
timings over every run of the load phase. Share: spawn ÷ (spawn + exec)
for the passed runs, p50. CPU: the back's mean during the load, in % of one
core (the cap is 200%). Workers: spawned / exited / alive / idle at the
end.

| run | load avg 1/5/15 min, start → end | verdicts | correct s | load s | queue s p50 / p95 | spawn ms p50 / p95 | exec ms p50 | share | CPU % | RSS max MiB (load) | workers | drained |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R0 before | 0.97/0.75/0.46 → 3.67/1.48/0.73 | accepted×12 | 0.16 / 0.39 / 0.39 | 57.1 | 0.00 / 0.00 | 99 / 129 | 19 | 0.85 | 7 | 358 | 12/12/0/— | yes |
| R0 after | 0.98/1.87/1.74 → 0.24/1.40/1.59 | accepted×12 | 0.02 / 0.15 / 0.15 | 55.4 | 0.00 / 0.00 | 0 / 102 | 3 | 0.00 | 2 | 328 | 1/0/1/1 | yes |
| R1 before | 0.95/2.31/1.70 → 3.45/2.31/1.76 | accepted×300 | 8.01 / 12.85 / 14.77 | 40.5 | 7.37 / 10.19 | 411 / 509 | 100 | 0.81 | 198 | 440 | 300/300/0/— | yes |
| R1 after | 0.94/1.31/1.50 → 0.73/1.04/1.37 | accepted×300 | 0.26 / 1.25 / 1.26 | 16.5 | 0.00 / 0.04 | 0 / 0 | 9 | 0.00 | 28 | 393 | 4/0/4/4 | yes |
| R1b before | 0.28/1.37/1.57 → 3.11/1.65/1.62 | accepted×300 | 7.61 / 11.79 / 13.80 | 38.3 | 6.99 / 9.22 | 397 / 492 | 102 | 0.79 | 198 | 476 | 300/300/0/— | yes |
| R1b after | 0.97/1.29/1.42 → 2.67/1.72/1.55 | accepted×300 | 0.29 / 1.22 / 1.24 | 16.5 | 0.00 / 0.02 | 0 / 0 | 8 | 0.00 | 28 | 402 | 4/0/4/4 | yes |
| R2 before | 0.78/1.04/1.37 → 1.51/1.41/1.46 | accepted×270, timeout×15, runtime_error×15 | 15.20 / 17.42 / 19.83 | 69.6 | 14.80 / 16.59 | 303 / 482 | 9 | 0.97 | 193 | 530 | 300/300/0/— | yes |
| R2 after (stalled) | 0.98/1.45/1.46 → 2.00/1.84/1.63 | accepted×270, timeout×15, runtime_error×15 | 6.19 / 44.93 / 45.49 | 68.2 | 5.80 / 13.91 | 0 / 283 | 4 | 0.00 | 169 | 458 | 19/15/4/4 | yes |
| R2x before | 0.98/2.41/2.83 → 3.36/2.34/2.69 | accepted×270, timeout×15, runtime_error×15 | 15.08 / 16.32 / 19.34 | 68.3 | 14.62 / 15.87 | 298 / 397 | 10 | 0.97 | 193 | 474 | 300/300/0/— | yes |
| R2x after | 1.17/3.86/3.30 → 1.31/3.19/3.15 | accepted×270, timeout×15, runtime_error×15 | 6.12 / 14.04 / 14.60 | 43.8 | 5.71 / 13.80 | 0 / 269 | 4 | 0.00 | 198 | 412 | 18/15/3/3 | yes |
| R3 before | 0.93/1.39/1.45 → 1.52/1.59/1.51 | accepted×210, timeout×45, runtime_error×45 | 38.20 / 41.49 / 42.11 | 142.3 | 37.57 / 41.02 | 286 / 390 | 11 | 0.97 | 197 | 490 | 300/300/0/— | yes |
| R3 after (stalled) | 0.96/1.58/1.55 → 3.72/2.53/1.93 | accepted×210, timeout×45, runtime_error×45 | 35.54 / 51.08 / 60.02 | 125.7 | 29.78 / 36.18 | 0 / 285 | 6 | 0.00 | 195 | 497 | 48/45/3/3 | yes |
| R3x before | 0.93/1.53/1.89 → 0.94/1.30/1.70 | accepted×210, timeout×45, runtime_error×45 | 36.59 / 40.80 / 41.22 | 142.2 | 36.10 / 40.49 | 283 / 315 | 11 | 0.97 | 196 | 516 | 300/300/0/— | yes |
| R3x after | 0.99/1.78/2.28 → 1.19/1.54/2.06 | accepted×210, timeout×45, runtime_error×45 | 28.78 / 36.21 / 36.40 | 125.4 | 28.42 / 35.99 | 0 / 281 | 5 | 0.00 | 193 | 467 | 48/45/3/3 | yes |

Every run **passed**: every submission got a verdict, every verdict matched
what was sent, no 5xx, no network error, no submission that never
completed. Every run's judge drained within a poll of the load's end, with
every live worker an idle one in the pool (`alive = idle`).

**Workers.** The pool behaves as designed. R0 spawned one worker for 12
submissions; R1 four for 300, all four idle at the end. With bad solutions,
every memory bomb discards its worker, so R2 spawned 4 + 15 (or fewer, when
a discarded worker's replacement was not needed) and R3 4 + 45 at most — 19,
18, 48 and 48. A loop keeps its worker.

## The stall in the first R2 and R3 after

In the first R2 after, a correct submission's p95 was 45 s, while the back's
own timings never put one past 14.4 s from arrival to its last case. For
about 30 s the harness got nothing back. Its 1-second poll of
`/organizer/stats/process` took 30.4 s, and no submission reached the back.
The back did not cause it:

- its event loop was idle throughout (utilization 0.00, delay under 1 ms);
- its judge had finished every run it had;
- the CPU limiter was not throttling it.

R3 after had two shorter gaps (8 s and 17 s). Neither happened in the
before runs or in any later run.

R2x and R3x repeat the pair, before and after, to separate the change from
that stall. A probe timing a committing transaction every 500 ms against the
shared Postgres ran during them and saw no commit over 134 ms. R2x after
has no gap, and its numbers agree with the back's timings. So the stall is
read as an artefact of the shared machine, most likely the database or the
disk under the other worktrees' load, not of the pool. **The comparison for
R2 and R3 uses R2x and R3x.**

## Against the plan's criterion (decision 9)

- **R1: the correct submission's p50 and the load phase's duration fall by
  at least 20%.** p50 8.01 s → 0.26 s (−97%) and 7.61 s → 0.29 s (−96%);
  load phase 40.5 s → 16.5 s (−59%) and 38.3 s → 16.5 s (−57%). **Met.**
- **R2 and R3 do not worsen the correct submission's p50.** R2x: 15.08 s →
  6.12 s (−59%); its p95 and max fall too (16.3 → 14.0 s, 19.3 → 14.6 s).
  R3x: 36.59 s → 28.78 s (−21%); p95 40.8 → 36.2 s, max 41.2 → 36.4 s.
  **Met.**
- **Every run passes: coherent verdicts, judge drained, no 5xx.** All 14
  runs. **Met.**

The change is kept.

## What changed

- **The spawn is gone from the path of almost every submission.** Spawn
  p50 is 0 in every after run: only the first submissions after a boot, and
  the ones that replace a discarded worker, pay it. The spawn share of a
  passed run's judge time goes from 0.79–0.97 to 0.00 at p50.
- **R1 is no longer limited by the judge.** With every solution correct, the
  back judged 300 submissions at 28% CPU on average, against 198% (its whole
  cap) before. The queue is gone (p95 0.04 s against 10.2 s). The load
  phase now lasts as long as the harness's own pacing: 3 submissions per
  team with the 5 s cooldown between them.
- **Execution got faster too.** A passed run's exec p50 went from about
  100 ms to 9 ms in R1, most likely because the two CPUs no longer compile
  several QuickJS modules while the cases run. (#137's caveat on the
  spawn/exec split applies to the before numbers.)
- **With bad solutions, the loops are the floor.** A loop holds its slot for
  5 cases × 2 s. 15 loops over 4 slots are at least 37.5 s of judge time,
  45 loops at least 112.5 s. In R2 the pool halves the wait (correct
  submission p50 15.1 s → 6.1 s); in R3 the load phase was already close to
  its floor, so the gain is smaller. R3x's load phase went from 142.2 s to
  125.4 s, against a floor of 112.5 s, and the correct submission's p50 from
  36.6 s to 28.8 s. The loops themselves wait less as well (R2x p50 24.8 s →
  15.6 s). A shorter time slot
  for loops, or a smaller `JUDGE_TIMEOUT_MS`, would be the lever there; that
  is out of scope.
- **Memory.** The back's RSS at the load's peak did not grow: 328–467 MiB
  after (497 in the stalled R3), against 358–530 MiB before. Four idle workers cost less than the
  spawns they replace.

## Not measured here

- **The VPS (#139).** These runs are local, under a cgroup limiter.
- **Whether RSS grows over many reuses.** There is no limit on how many
  submissions a worker serves (plan decision 8): each case gets a fresh
  runtime and context, and every irregular outcome discards the worker. No
  run here served enough submissions to show a drift. If the settle RSS
  grows from run to run on the VPS, that becomes a "Discovered from #277"
  issue.
