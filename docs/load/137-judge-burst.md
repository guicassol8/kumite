# Judge under a burst (#137)

The first wave of a round, measured with the load harness's `burst` scenario
(`back/src/load/`, see its `README.md`). 100 teams send their first
submission at the same moment, 300 in total over a round of 5 problems, with
0%, 10% or 30% of bad solutions. Half of the bad ones are infinite loops and
half are memory bombs. The back's judge concurrency is varied over 2, 4 and
8.

All the runs are local. **Pending: confirmation on the VPS (#139).** The raw
reports (`report.md` and `report.json` per run) are in [`137/`](137/).

All eight runs **passed**. Every submission got a verdict, and every verdict
matched what was sent: the correct solution `accepted`, the loop `timeout`,
the memory bomb `runtime_error`. There was no 5xx, no network error and no
submission that never completed. The judge drained after every run, with
every spawned worker exited.

## Environment

| | |
|---|---|
| Machine | WSL2 (Linux 6.18) on 12 logical CPUs, 7.7 GiB RAM |
| Back | `tsx src/main.ts` on Node 24.21.0, at commit `ed48fe6` |
| Limiter | `systemd-run --user --scope -p CPUQuota=200% -p MemoryMax=4G -p MemorySwapMax=0`. `systemctl --user show` on every run's scope confirmed `CPUQuotaPerSecUSec=2s`, `MemoryMax=4294967296` and `MemorySwapMax=0` |
| Judge | `JUDGE_CONCURRENCY` set on the back's command line (2, 4 or 8, which the report's judge section confirms), `JUDGE_TIMEOUT_MS=2000`, `JUDGE_MEMORY_MB=64` |
| Database | the native Postgres on the same machine (port 5487), outside the limiter |

Before every run:

- the database was reset with `pnpm worktree:env --reset`;
- the back was restarted;
- the harness waited for a 1-minute load average under 1.0, with no
  Playwright, vitest or lefthook process running.

Nothing else ran on the machine during the measurements. The load average at
the harness's start is below; the back had just booted by then.

| # | run | `JUDGE_CONCURRENCY` | harness load average (1/5/15 min), start → end |
|---|---|---|---|
| R0 | `pnpm load burst --teams 1 --members 1 --sse 0 --submissions 12 --bad-fraction 0 --problems 1` | 4 | 1.04 / 1.73 / 1.05 → 0.37 / 1.33 / 0.96 |
| R1 | `pnpm load:burst --sse 0 --bad-fraction 0` | 4 | 0.37 / 1.24 / 0.94 → 1.89 / 1.59 / 1.11 |
| R2 | `pnpm load:burst --sse 0 --bad-fraction 0.1` | 4 | 0.85 / 1.34 / 1.08 → 1.59 / 1.53 / 1.21 |
| R3 | `pnpm load:burst --sse 0 --bad-fraction 0.3` | 4 | 0.88 / 1.36 / 1.16 → 2.63 / 1.96 / 1.44 |
| R4 | `pnpm load:burst --sse 0 --bad-fraction 0.1` | 2 | 0.90 / 1.57 / 1.34 → 1.96 / 1.73 / 1.45 |
| R5 | `pnpm load:burst --sse 0 --bad-fraction 0.1` | 8 | 1.01 / 1.49 / 1.38 → 3.26 / 1.82 / 1.48 |
| R6 | `pnpm load:burst --sse 0 --bad-fraction 0.3` | 2 | 1.01 / 1.42 / 1.37 → 2.05 / 1.83 / 1.56 |
| R7 | `pnpm load:burst --sse 0 --bad-fraction 0.3` | 8 | 1.19 / 1.60 / 1.49 → 0.90 / 1.40 / 1.43 |

R0 is the reference: one team, one submission at a time, no contention.
R1–R7 run with no SSE connection, which isolates the judge; #138's runs add
400 streams to the same burst (`docs/load/138-sse-fanout.md`). The load
averages climb by the end because the burst itself saturates the back's two
CPUs.

## Verdicts and what a participant waits

`POST /submissions` latency until the 201's last byte: p50 / p95 / max, in
seconds.

| # | conc. | bad | verdicts | correct | loop | memory bomb |
|---|---|---|---|---|---|---|
| R0 | 4 | 0% | accepted×12 | 0.1 / 0.1 / 0.1 | — | — |
| R1 | 4 | 0% | accepted×300 | 7.3 / 11.0 / 12.6 | — | — |
| R2 | 4 | 10% | accepted×270, timeout×15, runtime_error×15 | 15.0 / 16.4 / 19.4 | 24.9 / 26.8 / 26.8 | 15.3 / 18.7 / 18.7 |
| R3 | 4 | 30% | accepted×210, timeout×45, runtime_error×45 | 37.4 / 41.7 / 42.5 | 46.0 / 51.2 / 52.2 | 37.7 / 41.2 / 42.5 |
| R4 | 2 | 10% | accepted×270, timeout×15, runtime_error×15 | 24.2 / 31.3 / 31.9 | 33.9 / 38.5 / 38.5 | 24.3 / 31.8 / 31.8 |
| R5 | 8 | 10% | accepted×270, timeout×15, runtime_error×15 | 12.3 / 14.9 / 17.2 | 22.2 / 24.4 / 24.4 | 12.7 / 17.4 / 17.4 |
| R6 | 2 | 30% | accepted×210, timeout×45, runtime_error×45 | 73.6 / 83.0 / 83.8 | 83.1 / 85.3 / 93.4 | 73.7 / 82.9 / 83.7 |
| R7 | 8 | 30% | accepted×210, timeout×45, runtime_error×45 | 22.2 / 23.4 / 26.9 | 32.5 / 33.5 / 36.7 | 22.8 / 24.3 / 26.2 |

- **The memory bomb is cheap.** It runs out of QuickJS's 64 MiB in tens of
  milliseconds, so it costs about what a correct solution costs. The loop is
  the expensive bad submission: 5 cases × 2 s of a slot each.
- **The slowest submission took 93 s** (R6). The 290 s ceiling was never
  approached.

## Queue, spawn and execution

The back now measures each judged submission
(`GET /organizer/stats/process`):

- **queue**: from arrival to a judge slot;
- **spawn**: from the slot to the worker's `ready`, that is, the worker
  thread started and QuickJS's WASM loaded;
- **exec**: from `ready` to the last case's reply;
- **case**: the time the worker itself measured running the cases.

Over the 300 runs of the load phase (12 for R0):

| # | conc. | queue s, p50 / p95 / max | spawn ms, passed, p50 / p95 | exec ms, passed, p50 / p95 | spawn ÷ (spawn + exec), passed, p50 | case ms, passed, p50 | largest queue at an arrival | back CPU % mean | RSS max MiB | lag p99 ms | load s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R0 | 4 | 0 / 0 / 0 | 93 / 99 | 16 / 17 | 0.85 | 11.8 | 0 | 6 | 331 | 7 | 57 |
| R1 | 4 | 6.7 / 8.8 / 10.2 | 395 / 479 | 103 / 188 | 0.79 | 21.4 | 88 | 198 | 470 | 82 | 37 |
| R2 | 4 | 14.6 / 15.8 / 17.2 | 298 / 398 | 8 / 100 | 0.97 | 3.9 | 88 | 193 | 432 | 80 | 68 |
| R3 | 4 | 36.9 / 41.3 / 42.3 | 280 / 369 | 8 / 84 | 0.97 | 3.7 | 96 | 197 | 497 | 71 | 141 |
| R4 | 2 | 24.0 / 31.1 / 31.8 | 127 / 205 | 8 / 49 | 0.94 | 3.6 | 98 | 192 | 370 | 67 | 103 |
| R5 | 8 | 11.2 / 11.9 / 13.9 | 798 / 900 | 104 / 305 | 0.88 | 5.5 | 79 | 193 | 624 | 93 | 61 |
| R6 | 2 | 73.3 / 82.8 / 83.7 | 125 / 206 | 8 / 63 | 0.94 | 3.7 | 98 | 196 | 448 | 59 | 255 |
| R7 | 8 | 21.3 / 22.4 / 23.3 | 701 / 803 | 89 / 115 | 0.89 | 5.0 | 83 | 198 | 684 | 91 | 94 |

CPU % is of one core, and the limiter allows 200%. "Largest queue at an
arrival" counts the arriving submission itself.

**A caveat on the spawn/exec split.** The main thread timestamps `ready` when
it handles the message, while the worker has already received its first case
and starts it at once. When the main thread is busy, part of the execution is
therefore counted as spawn. The worker's own case time is immune to this, and
it tells the same story. A correct solution's five cases take 4–21 ms at
p50, out of 110–900 ms of worker lifetime. Outside the queue, starting the
worker and loading QuickJS is 89–99% of a correct submission's judge time at
p50 by that measure, in every run, R0 included.

## The first wave

Sorting the load phase's runs by arrival, the p95 queue wait of the first k
arrivals, in seconds. The last column is the first k at which that p95
passes 5 s, the threshold chosen for this report (Q1: one full cooldown, the
wait the UI already teaches as normal).

| # | conc. | bad | k = 10 | 25 | 50 | 75 | 100 | first k past 5 s |
|---|---|---|---|---|---|---|---|---|
| R1 | 4 | 0% | 0.6 | 1.9 | 4.3 | 7.0 | 9.7 | 55 |
| R2 | 4 | 10% | 0.7 | 2.1 | 5.7 | 11.6 | 16.4 | 46 |
| R3 | 4 | 30% | 0.6 | 10.2 | 15.0 | 26.6 | 37.5 | 24 |
| R4 | 2 | 10% | 0.7 | 2.8 | 13.9 | 24.2 | 27.6 | 27 |
| R5 | 8 | 10% | 0.0 | 1.9 | 5.3 | 9.5 | 13.1 | 49 |
| R6 | 2 | 30% | 1.1 | 21.7 | 34.0 | 56.1 | 78.3 | 15 |
| R7 | 8 | 30% | 0.0 | 2.7 | 9.6 | 15.4 | 21.9 | 36 |

## Acceptance (#137)

- **Every submission gets a valid, coherent verdict at 0%, 10% and 30% bad**
  (R1–R3, and R4–R7 as well): no 5xx, no request that never completed.
  Accepted.
- **A timeout or a memory bomb frees its slot and the queue keeps going.**
  Every run's judge drained within a poll of the load's end: nothing in
  flight, nothing waiting, and as many workers exited as were spawned
  (`300/300`, 0 alive). Accepted.
- **p50/p95/p99, queue vs execution, spawn cost, CPU and RAM recorded as
  observations.** They are in the tables above and in each raw report.
  Accepted.
- **The confirmed bottleneck gets an issue instead of a fix here.** It is the
  spawn, below, and it already had one: #277, now raised to P2 with these
  numbers.

## Conclusion

- **Where the wait starts to hurt.** Holding the threshold at a p95 queue
  wait above 5 s, with the default concurrency of 4 on 2 vCPUs, the wait
  passes it from about **55** simultaneous teams when every solution is
  correct, **46** with 10% bad and **24** with 30% bad. With concurrency 2:
  27 and 15. With 8: 49 and 36. A whole first wave of 100 teams waits
  10–38 s at p95 with concurrency 4, by the bad fraction.
- **The spawn dominates.** Starting the worker and loading QuickJS is
  0.79–0.97 of a correct submission's judge time (p50), and the cases
  themselves are a few milliseconds. With no contention at all (R0) the
  spawn is still 93 ms against 16 ms of execution. A pool of warm workers
  (#277) removes that cost from every submission, and is the largest
  throughput gain available in the judge.
- **CPU and queue against concurrency.** The judge is CPU-bound. While a
  queue exists, the back sits at about 195% of its 200% cap at every
  concurrency, and a correct submission costs about 0.25 s of CPU (R1: 300
  in 37 s on 2 cores).
  - More slots do not add CPU. They trade queue time for a slower spawn: 2
    slots spawn in about 130 ms, 4 in about 300 ms, 8 in about 750 ms, with
    the same 2 vCPUs compiling more WASM modules at once.
  - With bad solutions, more slots still help, because a loop holds its slot
    for 10 s. At 10% bad the correct solution's p50 goes 24.2 s → 15.0 s →
    12.3 s for 2 → 4 → 8; at 30% it goes 73.6 s → 37.4 s → 22.2 s.
  - Going 4 → 8 also costs RSS (up to 684 MiB against 497 MiB) and
    event-loop lag (p99 about 90 ms against 70–80 ms).
  - No default changes here (out of scope): the numbers are for #277 and
    for the VPS check.
- **Event loop.** As in #136, the lag p99 rises to 60–90 ms whenever the
  CPU touches the quota. That fits CFS throttling of the whole process,
  which a real 2-vCPU VPS may not reproduce.

Pending: confirmation on the VPS (#139). Its comment lists the commands to
repeat there (R2 and R3 among them).
