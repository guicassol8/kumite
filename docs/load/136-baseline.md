# Back baseline (#136)

The first measurements taken with the load harness (`back/src/load/`, see
its `README.md`), following only that README. All of them are local: the
VPS is measured in the windows agreed in #137–#139. The raw reports
(`report.md` and `report.json` per run) are in [`136/`](136/).

All five runs **passed**: every action they started completed, with no 5xx,
no unexpected status, no network error, no SSE drop or invalid payload, and
no incoherent verdict.

## Environment

| | |
|---|---|
| Machine | WSL2 (Linux 6.18) on 12 logical CPUs, 7.7 GiB RAM |
| Back | `tsx src/main.ts` on Node 24.21.0, at commit `3c03ce3` |
| Limiter | `systemd-run --user --scope -p CPUQuota=200% -p MemoryMax=4G -p MemorySwapMax=0`. `systemctl --user show` on the scope confirmed `CPUQuotaPerSecUSec=2s`, `MemoryMax=4294967296` and `MemorySwapMax=0` |
| Database | the native Postgres on the same machine (port 5487), outside the limiter |
| Back config | the defaults: `JUDGE_CONCURRENCY=4`, `JUDGE_TIMEOUT_MS=2000`, `SUBMISSION_COOLDOWN_MS=5000` |

Before every run except the last one, the database was reset with
`pnpm worktree:env --reset` and the back restarted. Each run waited for a
quiet machine: no Playwright, vitest or lefthook process, and a 1-minute
load average under 2.

| # | run | harness load average (1/5/15 min), start → end |
|---|---|---|
| 1 | `pnpm load:baseline --sse 300` | 1.60 / 3.80 / 3.93 → 0.72 / 2.50 / 3.37 |
| 2 | `pnpm load:baseline --sse 400` | 0.69 / 2.43 / 3.34 → 0.16 / 1.14 / 2.57 |
| 3 | `pnpm load:smoke` (a) | 0.49 / 1.16 / 2.55 → 0.26 / 0.92 / 2.31 |
| 4 | `pnpm load:smoke` (b) | 0.35 / 0.28 / 0.10 → 0.29 / 0.33 / 0.15 |
| 5 | `pnpm load:smoke` again, with no reset and no restart | 0.22 / 0.31 / 0.14 → 0.38 / 0.39 / 0.19 |

Some notes on these runs:

- The 5- and 15-minute averages of runs 1–3 are still coming down from this
  task's own pre-push. It ended a few minutes before run 1, and no other
  process was competing.
- Between runs 3 and 4 the machine lost power and rebooted. Runs 4 and 5
  ran on a freshly booted machine, with the same commit, back command,
  limiter and flags.
- A first trial smoke ran earlier against an unlimited back, with
  `--rest 2 --duration 40` and a load average of 4.7–6.2. It is not
  comparable and is not reported here.
- The committed `report.json` files differ from the originals in one way:
  each sample's copy of the event-loop ring is emptied. That is the same
  transform the harness now applies itself (`withoutRing` in
  `report.ts`), and it took the baseline JSON from 9 MB to 0.3 MB. The
  deduplicated windows (`timeline.windows`) and every number are untouched.

## At rest and with idle SSE connections

These come from the two baseline runs: 100 teams of 3 (300 participants), no
round and no submission. CPU % is of one core, and the limiter allows 200%.

| phase | CPU % mean (max) | RSS max | heap max | event-loop lag: p99 of the 1 s windows (max) | ELU mean |
|---|---|---|---|---|---|
| rest, 60 s (run 1) | 1.0 (7.5) | 281 MiB | 99 MiB | 10.6 ms (10.6) | 0.007 |
| rest, 60 s (run 2) | 0.9 (1.5) | 280 MiB | 87 MiB | 1.2 ms (1.2) | 0.007 |
| 300 idle SSE, 120 s | 1.8 (17.1) | 265 MiB | 113 MiB | 6.9 ms (14.4) | 0.013 |
| 400 idle SSE, 120 s | 1.6 (9.7) | 290 MiB | 124 MiB | 8.4 ms (8.8) | 0.013 |

- **Idle streams are cheap.** Going from 0 to 400 connections leaves CPU
  under 2% of a core. Memory stays within run-to-run noise: RSS 265 vs
  290 MiB, heap 113 vs 124 MiB.
- **Opening the streams is fast.** Connecting 300 or 400 streams at
  50 per second took 6 s and 8 s. CPU peaked at 95% and 36%. `GET /sse`
  answered with headers at a p50 of 2 ms and a p99 of 17 ms and 10 ms.
- **Heartbeats stay on time.** The server-side count reached 300 and 400.
  None of the 700 streams dropped. The gap between heartbeats was
  1000.2 ms at p50 and 1004–1005 ms at p99, with a maximum of 1011 ms.
- **The cost of streaming events** (ranking fan-out and payload size) is
  #138's to measure.

## Setup: the signup rush

Each baseline run ran 300 signups, 300 logins, 100 team creations and 200
joins, with 4 requests in flight.

| | run 1 | run 2 |
|---|---|---|
| setup duration | 73.1 s | 71.9 s |
| back CPU % mean (max) | 134 (148) | 133 (147) |
| `POST /auth/signup` p50 / p95 / max | 496 / 589 / 609 ms | 492 / 587 / 688 ms |
| `POST /auth/login` p50 / p95 / max | 490 / 580 / 597 ms | 489 / 581 / 667 ms |
| `GET /organizer/stats/live` during setup, p50 / p95 / max | 81 / 302 / 473 ms | 87 / 295 / 382 ms |
| the same route at rest, p50 | 3.4 ms | 3.3 ms |
| event-loop lag, p99 of the windows | 88 ms | 86 ms |
| RSS max | 356 MiB | 475 MiB |

- **Throughput.** That works out to about 8 argon2 operations per second (a
  signup hashes, a login verifies) on the 2-CPU back.
- **Other routes slow down.** During setup, a route that has nothing to do
  with argon2 answers about 25 times slower than at rest. The event loop
  stalls by up to ~90 ms per window.
- **This is only 4 requests in flight.** A real opening rush, with more
  people signing up at once, has not been measured. That is #436.

## Smoke: two clean runs and one on a dirty database

Each smoke run had 10 teams of 2, 20 SSE connections and 30 submissions.
Three of the 30 were infinite loops, at indices 9, 19 and 29. Each run had a
90 s load window with a 5 s cooldown per team.

| | (a) | (b) | no reset |
|---|---|---|---|
| already in the database | nothing | nothing | 20 participants, 10 teams, plus the warning |
| setup duration | 4.7 s | 5.1 s | 4.7 s |
| verdicts | 27 accepted + 3 timeout | 27 + 3 | 27 + 3 |
| incoherent | 0 | 0 | 0 |
| submissions started / completed | 30 / 30 | 30 / 30 | 30 / 30 |
| `POST /submissions` p50 / p95 / max | 490 / 10219 / 10952 ms | 483 / 10121 / 10915 ms | 416 / 10202 / 10887 ms |
| back CPU % mean (max), load phase | 40.1 (199.9) | 40.0 (202.0) | 40.2 (201.4) |
| RSS max, load phase | 402 MiB | 424 MiB | 314 MiB |
| event-loop lag, p99 of the windows, load phase | 68.8 ms | 70.3 ms | 67.6 ms |
| judge `waiting` max (sampled at 1 Hz) | 6 | 6 | 0 |
| SSE opened / dropped | 20 / 0 | 20 / 0 | 20 / 0 |
| heartbeat gap, p99 | 1001.9 ms | 1002.2 ms | 1002.3 ms |

- **Two clean runs agree.** Runs (a) and (b) give the same counts and
  verdicts, and their latency, CPU and lag are within a few percent of each
  other. That holds even with a reboot in between.
- **A dirty database does not break a run.** The run without a reset or
  restart found the earlier run's data, warned about it, and still passed.
  Its own `load-<runId>` accounts, teams and round collided with nothing.
  Its RSS is lower and its judge queue was never caught non-empty. That run
  started on a back that had already been running and judging, which is
  exactly why the README asks for a restart between runs that are meant to
  be compared.
- **Most of the slow submissions are the loops.** The p95 of about 10 s is
  the three infinite loops: every case runs to the 2 s judge timeout. While
  a loop holds a judge slot, the other teams' submissions queue behind it,
  with up to 6 waiting on 4 slots. How that queue behaves under a burst is
  #137's subject.

## Observations

- **Event loop under the cgroup cap.** In both kinds of load, CPU touches
  the 200% quota: argon2's threadpool in setup, the judge's worker threads
  in the smoke load phase. Whenever it does, the event-loop lag p99 rises
  from about 1–10 ms to about 70–90 ms.
  - That looks like CFS quota throttling, which stops every thread of the
    process, the main one included, until the next period.
  - Whether a real 2-vCPU VPS behaves the same way is for #137–#139 to see.
    These are local numbers under `systemd-run`.
- **Signup rush.** It is a candidate bottleneck that no issue of #135
  covers. It is now #436 (P2, "Discovered from #136").
- **Memory.** The back never came near the 4 GB limit. The largest RSS
  measured was 489 MiB, during a smoke setup.
