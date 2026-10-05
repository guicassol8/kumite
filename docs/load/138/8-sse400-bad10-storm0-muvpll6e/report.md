# Load report: burst `muvpll6e`

**FAIL**

## Failures

- 35× network error on POST /submissions (load), 0 of them timeouts
- 1× network error on GET /organizer/stats/live (settle), 0 of them timeouts
- submission: 300 started, 265 completed (35 never finished)

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:35:29.274Z |
| ended | 2026-10-05T20:38:33.002Z |
| node | v24.21.0 |
| commit | ed48fe6 |
| harness loadavg (1/5/15 min) at start | 0.84 / 1.37 / 1.42 |
| harness loadavg (1/5/15 min) at end | 3.23 / 1.79 / 1.54 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3137 |
| teams | 100 |
| members | 3 |
| sse | 400 |
| submissions | 300 |
| badFraction | 0.1 |
| memoryShare | 0.5 |
| problems | 5 |
| untilDone | true |
| storm | true |
| stormWindowSeconds | 0 |
| pastRounds | 0 |
| restSeconds | 30 |
| durationSeconds | 600 |
| setupConcurrency | 4 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 290000 |
| cooldownMs | 5000 |
| out | /home/guilherme/code/kumite/.claude/worktrees/agent-a431c3203c10c40c0/load-results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvpll6e (07b7ee3e-cc99-4817-b56b-941fa57b6474) |
| problem | 5bfcc070-62f3-48fe-abe8-38850e002556 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.9 | 279.6 | 67.2 | 5.3 | 5.3 | 0.007 | 0 | 0 | 30 |
| setup | 72.4 | 134.6 | 149.6 | 475.0 | 99.8 | 88.9 | 88.9 | 0.075 | 0 | 0 | 66 |
| sse-ramp | 8.0 | 34.9 | 50.4 | 295.2 | 102.4 | 11.8 | 11.8 | 0.318 | 0 | 388 | 8 |
| load | 69.6 | 195.6 | 202.9 | 668.5 | 177.9 | 502.1 | 502.1 | 0.345 | 93 | 400 | 17 |
| settle | 0.6 | 112.6 | 112.6 | 667.1 | 178.9 | 5.0 | 5.0 | 0.014 | 0 | 400 | 1 |
| storm | 3.0 | 106.8 | 127.7 | 652.6 | 195.1 | 33.5 | 33.5 | 0.699 | 0 | 400 | 2 |
| teardown | 0.1 | 24.0 | 24.0 | 625.7 | 183.4 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 5.8 | 16.6 | 16.6 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.4 | 9.5 | 9.5 | 0 |
| `POST /auth/login` | 1 | 200×1 | 84.9 | 84.9 | 84.9 | 84.9 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.6 | 4.6 | 4.6 | 4.6 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 20.5 | 20.5 | 20.5 | 20.5 | 0 |
| `GET /organizer/stats/live` | 66 | 200×66 | 91.8 | 288.1 | 397.1 | 397.1 | 0 |
| `GET /organizer/stats/process` | 66 | 200×66 | 93.1 | 288.9 | 395.9 | 395.9 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.3 | 11.3 | 11.3 | 11.3 | 0 |
| `POST /auth/login` | 300 | 200×300 | 488.9 | 586.5 | 597.1 | 690.1 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 492.1 | 586.7 | 605.3 | 685.9 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.8 | 4.4 | 4.4 | 4.4 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.6 | 7.0 | 7.0 | 7.0 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.5 | 9.5 | 9.5 | 9.5 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 7.9 | 7.9 | 7.9 | 7.9 | 0 |
| `POST /teams` | 100 | 201×100 | 8.0 | 11.6 | 12.5 | 12.6 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.6 | 14.0 | 21.6 | 23.5 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.3 | 6.5 | 6.5 | 6.5 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.3 | 4.7 | 4.7 | 4.7 | 0 |
| `GET /sse` | 400 | 200×400 | 2.4 | 3.1 | 10.7 | 18.6 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 17 | 200×17 | 471.3 | 15419.0 | 15419.0 | 15419.0 | 0 |
| `GET /organizer/stats/process` | 17 | 200×17 | 471.8 | 15418.7 | 15418.7 | 15418.7 | 0 |
| `POST /submissions` | 300 | 201×265, network×35 | 18032.1 | 25849.8 | 33290.7 | 37759.3 | 35 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×2, network×1 | 2.9 | 571.4 | 571.4 | 571.4 | 1 (0 timeouts) |
| `GET /organizer/stats/process` | 3 | 200×3 | 571.7 | 571.9 | 571.9 | 571.9 | 0 |
| `GET /ranking` | 1 | 200×1 | 6.7 | 6.7 | 6.7 | 6.7 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.9 | 8.9 | 8.9 | 8.9 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 10.2 | 396.2 | 396.2 | 396.2 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 9.6 | 397.1 | 397.1 | 397.1 | 0 |
| `GET /ranking` | 3 | 200×3 | 436.3 | 1435.3 | 1435.3 | 1435.3 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 607.1 | 1435.6 | 1435.6 | 1435.6 | 0 |
| `GET /sse` | 400 | 200×400 | 255.7 | 295.7 | 299.7 | 300.4 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.5 | 6.5 | 6.5 | 6.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 6.3 | 6.3 | 6.3 | 6.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 35.7 | 35.7 | 35.7 | 35.7 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 241 | 0 | 0 |
| memory | 0 | 13 | 0 |
| loop | 0 | 0 | 11 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |
| submission | 300 | 265 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 241 | 18014.4 | 24822.4 | 27318.0 | 28015.2 |
| memory | 13 | 15260.1 | 23563.0 | 23563.0 | 23563.0 |
| loop | 11 | 26401.9 | 37759.4 | 37759.4 | 37759.4 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 265 |
| by outcome | passed×241, runtime_error×13, timeout×11 |
| largest queue at an arrival (itself included) | 94 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 265 / 265 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 265 | 8986.9 | 19796.3 | 20808.2 | 21290.5 |
| all | spawn | 265 | 385.4 | 616.5 | 706.4 | 793.3 |
| all | exec | 265 | 13.5 | 421.3 | 10079.6 | 10093.1 |
| all | total | 265 | 10523.4 | 20604.9 | 28313.7 | 30686.4 |
| passed | queue | 241 | 8686.8 | 19796.3 | 20808.2 | 21290.5 |
| passed | spawn | 241 | 384.2 | 612.6 | 706.4 | 793.3 |
| passed | exec | 241 | 12.2 | 229.3 | 314.5 | 396.5 |
| passed | total | 241 | 9008.1 | 20299.1 | 21297.3 | 21707.7 |
| runtime_error | queue | 13 | 8922.1 | 19784.1 | 19784.1 | 19784.1 |
| runtime_error | spawn | 13 | 415.2 | 623.0 | 623.0 | 623.0 |
| runtime_error | exec | 13 | 279.2 | 522.5 | 522.5 | 522.5 |
| runtime_error | total | 13 | 9616.5 | 20484.5 | 20484.5 | 20484.5 |
| timeout | queue | 11 | 10302.2 | 20298.2 | 20298.2 | 20298.2 |
| timeout | spawn | 11 | 396.5 | 697.8 | 697.8 | 697.8 |
| timeout | exec | 11 | 10026.7 | 10093.1 | 10093.1 | 10093.1 |
| timeout | total | 11 | 20702.8 | 30686.4 | 30686.4 | 30686.4 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 988.9 | 990.5 |
| 25 | 3000.7 | 2692.2 |
| 50 | 7217.7 | 6888.8 |
| 75 | 16327.7 | 15706.0 |
| 100 | 21277.3 | 20406.2 |

First k whose p95 queue wait passes 5000 ms: 42.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 4870.8 / 7716.1 / 8141.6 / 9392.2 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 888.4 / 4075.0 / 4866.1 / 9392.2 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 70 | 74.2 | 78 |
| ranking.updated | 59 | 59 | 59 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 30888 | 60 | 60 | 60 |
| ranking.updated | 24000 | 28022 | 80989 | 91654 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.96 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 31 | 0 | 0.00 / 0.01 / 0.02 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 72 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 386 | 0.42 / 0.79 / 0.79 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 69 | 400 | 1.09 / 1.41 / 75.96 | — / — / — | — / — / — | — / — / — |
| load | ranking | 58 | 400 | 132.99 / 293.73 / 377.31 | 1.22 / 87.24 / 88.58 | 68.08 / 98.15 / 102.90 | 4.93 / 73.76 / 100.40 |
| settle | heartbeat | 1 | 400 | 0.72 / 0.72 / 0.72 | — / — / — | — / — / — | — / — / — |
| storm | heartbeat | 3 | 400 | 0.70 / 0.86 / 0.86 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.0 / 1.2 / 4.8 | 5.3 / 6.9 / 8.9 / 9.6 | 6.4 / 8.1 / 10.1 / 11.3 | 2 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 6.0 / 6.0 / 6.0 / 6.0 | 7.2 / 7.2 / 7.2 / 7.2 | 1 |
| storm | 400 | 176.0 / 180.8 / 181.2 / 181.9 | 1314.5 / 1539.0 / 1568.6 / 1571.5 | 1491.7 / 1714.5 / 1742.9 / 1744.9 | 396 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 632 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 14 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 255.7 / 295.7 / 299.7 / 300.4 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 436.0 / 469.7 / 472.9 / 473.9 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2062.7 / 2549.1 / 2589.5 / 2599.4 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2566 ms) |

