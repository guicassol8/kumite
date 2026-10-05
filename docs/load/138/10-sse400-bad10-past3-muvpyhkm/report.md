# Load report: burst `muvpyhkm`

**FAIL**

## Failures

- 5× network error on POST /submissions (load), 0 of them timeouts
- submission: 300 started, 295 completed (5 never finished)

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:45:31.130Z |
| ended | 2026-10-05T20:50:10.840Z |
| node | v24.21.0 |
| commit | ed48fe6 |
| harness loadavg (1/5/15 min) at start | 0.85 / 1.41 / 1.42 |
| harness loadavg (1/5/15 min) at end | 2.70 / 2.30 / 1.79 |
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
| pastRounds | 3 |
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
| round | load-muvpyhkm (c812baba-db53-4bec-a62c-d48d5156e4e4) |
| problem | 267dad09-2d8e-4c40-bcd3-03e3156004ae |
| problems in the round | 5 |
| past rounds | load-muvpyhkm-r0, load-muvpyhkm-r1, load-muvpyhkm-r2 |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 2.0 | 279.8 | 67.2 | 1.1 | 1.1 | 0.008 | 0 | 0 | 30 |
| setup | 111.5 | 156.2 | 206.8 | 474.0 | 115.6 | 91.0 | 96.2 | 0.128 | 84 | 0 | 105 |
| sse-ramp | 8.0 | 63.0 | 160.7 | 437.7 | 130.3 | 60.4 | 60.4 | 0.379 | 0 | 361 | 8 |
| load | 114.2 | 172.7 | 202.3 | 1995.5 | 710.7 | 691.8 | 696.9 | 0.364 | 88 | 400 | 7 |
| settle | 11.6 | 7.0 | 15.7 | 1967.9 | 327.0 | 9.0 | 9.0 | 0.030 | 0 | 400 | 4 |
| storm | 4.3 | 99.0 | 135.7 | 1927.7 | 353.2 | 49.5 | 49.5 | 0.774 | 0 | 400 | 3 |
| teardown | 0.1 | 13.4 | 13.4 | 1927.7 | 353.8 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 6.2 | 22.0 | 22.0 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.7 | 10.4 | 10.4 | 0 |
| `POST /auth/login` | 1 | 200×1 | 91.5 | 91.5 | 91.5 | 91.5 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 5.2 | 5.2 | 5.2 | 5.2 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 5.4 | 5.4 | 5.4 | 5.4 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.4 | 4.4 | 4.4 | 4.4 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 33.4 | 33.4 | 33.4 | 33.4 | 0 |
| `GET /organizer/stats/live` | 105 | 200×105 | 11.4 | 265.6 | 375.1 | 381.6 | 0 |
| `GET /organizer/stats/process` | 105 | 200×105 | 11.1 | 265.1 | 298.8 | 381.4 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.1 | 11.5 | 11.5 | 11.5 | 0 |
| `POST /auth/login` | 300 | 200×300 | 490.3 | 585.8 | 596.3 | 599.6 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 496.5 | 588.5 | 597.2 | 691.0 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.9 | 4.9 | 4.9 | 4.9 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.2 | 6.8 | 6.8 | 6.8 | 0 |
| `POST /organizer/rounds` | 4 | 201×4 | 8.4 | 8.8 | 8.8 | 8.8 | 0 |
| `POST /organizer/rounds/:id/close` | 3 | 200×3 | 7.6 | 8.2 | 8.2 | 8.2 | 0 |
| `POST /organizer/rounds/:id/open` | 4 | 200×4 | 7.5 | 8.4 | 8.4 | 8.4 | 0 |
| `POST /submissions` | 383 | 201×300, 429:submission_throttled×83 | 4212.0 | 10492.8 | 12486.2 | 12487.3 | 0 |
| `POST /teams` | 100 | 201×100 | 7.7 | 11.0 | 14.7 | 31.6 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.4 | 15.2 | 33.7 | 36.5 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.5 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.3 | 5.2 | 5.2 | 5.2 | 0 |
| `GET /sse` | 400 | 200×400 | 2.3 | 3.6 | 8.4 | 17.1 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 7 | 200×7 | 3555.0 | 41458.5 | 41458.5 | 41458.5 | 0 |
| `GET /organizer/stats/process` | 7 | 200×7 | 3555.0 | 41458.3 | 41458.3 | 41458.3 | 0 |
| `POST /submissions` | 300 | 201×295, network×5 | 25962.2 | 42404.9 | 42407.5 | 48155.0 | 5 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 5 | 200×5 | 1528.2 | 2780.4 | 2780.4 | 2780.4 | 0 |
| `GET /organizer/stats/process` | 5 | 200×5 | 1528.1 | 2780.4 | 2780.4 | 2780.4 | 0 |
| `GET /ranking` | 7 | 200×7 | 942.1 | 2196.2 | 2196.2 | 2196.2 | 0 |
| `GET /rounds/:id/ranking` | 7 | 200×7 | 942.1 | 2196.1 | 2196.1 | 2196.1 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 285.2 | 1467.2 | 1467.2 | 1467.2 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 283.2 | 1467.6 | 1467.6 | 1467.6 | 0 |
| `GET /ranking` | 3 | 200×3 | 1478.7 | 1880.3 | 1880.3 | 1880.3 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 510.5 | 1880.3 | 1880.3 | 1880.3 | 0 |
| `GET /sse` | 400 | 200×400 | 279.1 | 321.0 | 324.5 | 326.6 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.1 | 5.1 | 5.1 | 5.1 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 5.4 | 5.4 | 5.4 | 5.4 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 36.0 | 36.0 | 36.0 | 36.0 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 267 | 0 | 0 |
| memory | 0 | 13 | 0 |
| loop | 0 | 0 | 15 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |
| past-submission | 300 | 300 |
| submission | 300 | 295 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 267 | 25904.6 | 42404.9 | 42406.9 | 42407.6 |
| memory | 13 | 29340.8 | 42406.4 | 42406.4 | 42406.4 |
| loop | 15 | 35872.5 | 48155.0 | 48155.0 | 48155.0 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 295 |
| by outcome | passed×267, runtime_error×13, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.98 / 1.00 / 1.00 |
| workers spawned / exited / alive at the end | 595 / 595 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 295 | 2806.6 | 18003.0 | 20616.8 | 20999.5 |
| all | spawn | 295 | 412.6 | 797.3 | 892.2 | 1064.9 |
| all | exec | 295 | 10.9 | 9887.9 | 10109.1 | 10514.1 |
| all | total | 295 | 3805.0 | 18977.1 | 22900.3 | 29913.2 |
| passed | queue | 267 | 2753.9 | 17904.4 | 19988.5 | 20617.1 |
| passed | spawn | 267 | 424.2 | 791.0 | 885.0 | 1064.9 |
| passed | exec | 267 | 9.6 | 175.0 | 395.6 | 501.2 |
| passed | total | 267 | 3373.5 | 18527.6 | 20699.0 | 21003.2 |
| runtime_error | queue | 13 | 3407.9 | 20999.5 | 20999.5 | 20999.5 |
| runtime_error | spawn | 13 | 380.4 | 817.2 | 817.2 | 817.2 |
| runtime_error | exec | 13 | 311.3 | 995.8 | 995.8 | 995.8 |
| runtime_error | total | 13 | 4132.3 | 21700.7 | 21700.7 | 21700.7 |
| timeout | queue | 15 | 3012.8 | 19603.7 | 19603.7 | 19603.7 |
| timeout | spawn | 15 | 343.8 | 892.2 | 892.2 | 892.2 |
| timeout | exec | 15 | 10021.4 | 10514.1 | 10514.1 | 10514.1 |
| timeout | total | 15 | 13420.7 | 29913.2 | 29913.2 | 29913.2 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 929.2 | 929.2 |
| 25 | 3012.1 | 3012.5 |
| 50 | 10310.6 | 9727.6 |
| 75 | 15734.5 | 15103.4 |
| 100 | 20999.5 | 19604.0 |

First k whose p95 queue wait passes 5000 ms: 34.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 11327.7 / 16305.6 / 20754.6 / 20813.3 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 3.9 / 6325.3 / 10086.2 / 20813.3 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 126 | 130.1 | 134 |
| ranking.updated | 80 | 80.1 | 81 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 53640 | 60 | 60 | 60 |
| ranking.updated | 32431 | 67441 | 121640 | 130715 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 49.86 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.02 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 111 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| setup | ranking | 37 | 0 | 0.00 / 0.00 / 0.00 | 1.20 / 96.76 / 184.25 | 5.30 / 110.48 / 392.47 | 10.06 / 85.10 / 94.72 |
| sse-ramp | heartbeat | 8 | 380 | 0.38 / 0.79 / 0.79 | — / — / — | — / — / — | — / — / — |
| sse-ramp | ranking | 1 | 31 | 5.13 / 5.13 / 5.13 | 1.80 / 1.80 / 1.80 | 4.07 / 4.07 / 4.07 | 8.64 / 8.64 / 8.64 |
| load | heartbeat | 114 | 400 | 0.93 / 1.46 / 1.67 | — / — / — | — / — / — | — / — / — |
| load | ranking | 79 | 400 | 271.19 / 485.54 / 497.97 | 1.65 / 15.00 / 90.87 | 14.44 / 96.25 / 103.61 | 17.99 / 91.56 / 99.82 |
| settle | heartbeat | 12 | 400 | 0.84 / 1.32 / 1.32 | — / — / — | — / — / — | — / — / — |
| storm | heartbeat | 4 | 400 | 0.23 / 0.80 / 0.80 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.2 / 1.8 / 3.2 | 9.9 / 13.0 / 20.0 / 24.4 | 11.0 / 14.2 / 22.0 / 25.9 | 5 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 10.5 / 10.5 / 10.5 / 10.5 | 11.6 / 11.6 / 11.6 / 11.6 | 1 |
| storm | 400 | 142.1 / 166.5 / 170.0 / 170.1 | 2321.5 / 2582.0 / 2600.8 / 2609.8 | 2463.2 / 2722.1 / 2741.3 / 2754.3 | 397 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 2781 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 8771 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 279.1 / 321.0 / 324.5 / 326.6 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 419.8 / 460.6 / 463.7 / 464.3 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 3211.6 / 3870.4 / 3924.0 / 3935.3 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 3886 ms) |

