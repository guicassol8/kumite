# Load report: burst `muvyredr`

**FAIL**

## Failures

- 1× network error on GET /organizer/stats/live (load), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":1}
- 14× network error on POST /submissions (load), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":14}
- 1× network error on GET /organizer/stats/process (settle), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":1}
- submission: 300 started, 286 completed (14 never finished)

## Run

| field | value |
| --- | --- |
| target | http://localhost:3439 |
| started | 2026-10-06T00:51:56.948Z |
| ended | 2026-10-06T00:56:27.480Z |
| node | v24.21.0 |
| commit | ef2964c |
| harness loadavg (1/5/15 min) at start | 0.89 / 1.40 / 1.99 |
| harness loadavg (1/5/15 min) at end | 1.72 / 1.73 / 1.97 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3439 |
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
| resendStale | false |
| restSeconds | 30 |
| durationSeconds | 600 |
| setupConcurrency | 4 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 290000 |
| cooldownMs | 5000 |
| out | /home/guilherme/code/kumite/.worktrees/task-439-fanout-sse-frame-unico/load-results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvyredr (955cfccd-d289-4f0c-9096-b30ea8ade3f7) |
| problem | 2ef987c7-7a6a-43d1-929a-b93c41370a2e |
| problems in the round | 5 |
| past rounds | load-muvyredr-r0, load-muvyredr-r1, load-muvyredr-r2 |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.2 | 1.8 | 279.6 | 68.0 | 18.0 | 18.0 | 0.009 | 0 | 0 | 30 |
| setup | 117.5 | 154.4 | 209.3 | 474.6 | 116.9 | 86.8 | 93.3 | 0.124 | 87 | 0 | 110 |
| sse-ramp | 8.0 | 57.5 | 118.3 | 470.4 | 148.4 | 70.1 | 70.1 | 0.372 | 0 | 378 | 8 |
| load | 90.3 | 179.5 | 199.3 | 572.7 | 198.5 | 163.9 | 163.9 | 0.117 | 96 | 400 | 7 |
| settle | 20.1 | 21.1 | 55.9 | 522.5 | 141.3 | 6.5 | 6.5 | 0.021 | 0 | 400 | 5 |
| storm | 4.4 | 105.9 | 137.8 | 644.0 | 284.9 | 44.8 | 44.8 | 0.775 | 0 | 400 | 3 |
| teardown | 0.1 | 33.6 | 33.6 | 644.0 | 263.4 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.8 | 5.9 | 38.4 | 38.4 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.6 | 5.6 | 30.2 | 30.2 | 0 |
| `POST /auth/login` | 1 | 200×1 | 120.9 | 120.9 | 120.9 | 120.9 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.9 | 4.9 | 4.9 | 4.9 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 6.9 | 6.9 | 6.9 | 6.9 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.9 | 4.9 | 4.9 | 4.9 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 20.2 | 20.2 | 20.2 | 20.2 | 0 |
| `GET /organizer/stats/live` | 110 | 200×110 | 14.6 | 294.0 | 391.6 | 596.5 | 0 |
| `GET /organizer/stats/process` | 110 | 200×110 | 14.4 | 288.4 | 348.8 | 393.3 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 30.2 | 75.2 | 75.2 | 75.2 | 0 |
| `POST /auth/login` | 300 | 200×300 | 495.9 | 595.3 | 689.0 | 699.6 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 506.3 | 604.4 | 685.3 | 723.7 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 20.0 | 36.4 | 36.4 | 36.4 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 7.1 | 46.2 | 46.2 | 46.2 | 0 |
| `POST /organizer/rounds` | 4 | 201×4 | 9.5 | 25.4 | 25.4 | 25.4 | 0 |
| `POST /organizer/rounds/:id/close` | 3 | 200×3 | 13.5 | 24.9 | 24.9 | 24.9 | 0 |
| `POST /organizer/rounds/:id/open` | 4 | 200×4 | 22.1 | 46.5 | 46.5 | 46.5 | 0 |
| `POST /submissions` | 382 | 201×300, 429:submission_throttled×82 | 4214.1 | 10674.5 | 12506.3 | 12818.3 | 0 |
| `POST /teams` | 100 | 201×100 | 22.7 | 64.8 | 69.5 | 288.6 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 24.2 | 114.4 | 442.0 | 443.1 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.6 | 4.8 | 4.8 | 4.8 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /sse` | 400 | 200×400 | 2.4 | 3.3 | 5.0 | 22.7 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 7 | 200×6, network×1 | 2502.8 | 24707.9 | 24707.9 | 24707.9 | 1 (0 timeouts) |
| `GET /organizer/stats/process` | 7 | 200×7 | 9860.1 | 24708.5 | 24708.5 | 24708.5 | 0 |
| `POST /submissions` | 300 | 201×286, network×14 | 21249.2 | 29673.5 | 34861.1 | 37772.9 | 14 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 6 | 200×6 | 3139.2 | 7205.8 | 7205.8 | 7205.8 | 0 |
| `GET /organizer/stats/process` | 6 | 200×5, network×1 | 4221.1 | 7205.8 | 7205.8 | 7205.8 | 1 (0 timeouts) |
| `GET /ranking` | 7 | 200×7 | 708.9 | 3595.7 | 3595.7 | 3595.7 | 0 |
| `GET /rounds/:id/ranking` | 7 | 200×7 | 808.9 | 3595.5 | 3595.5 | 3595.5 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 174.8 | 362.6 | 362.6 | 362.6 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 176.6 | 364.7 | 364.7 | 364.7 | 0 |
| `GET /ranking` | 3 | 200×3 | 1426.2 | 2003.7 | 2003.7 | 2003.7 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 407.9 | 2003.6 | 2003.6 | 2003.6 | 0 |
| `GET /sse` | 400 | 200×400 | 246.5 | 291.3 | 302.7 | 304.0 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.6 | 5.6 | 5.6 | 5.6 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 37.3 | 37.3 | 37.3 | 37.3 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 256 | 0 | 0 |
| memory | 0 | 15 | 0 |
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
| submission | 300 | 286 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 256 | 21247.8 | 26661.5 | 31083.0 | 31084.7 |
| memory | 15 | 21249.2 | 26661.9 | 26661.9 | 26661.9 |
| loop | 15 | 30449.4 | 37773.0 | 37773.0 | 37773.0 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 286 |
| by outcome | passed×256, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 0.99 |
| workers spawned / exited / alive at the end | 586 / 586 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 286 | 3341.2 | 16107.1 | 18386.4 | 18920.1 |
| all | spawn | 286 | 382.4 | 485.5 | 513.6 | 599.1 |
| all | exec | 286 | 12.2 | 10007.9 | 10083.6 | 10106.1 |
| all | total | 286 | 3988.0 | 17208.2 | 19401.4 | 28217.5 |
| passed | queue | 256 | 3341.2 | 16107.1 | 18386.4 | 18920.1 |
| passed | spawn | 256 | 381.5 | 485.5 | 513.6 | 599.1 |
| passed | exec | 256 | 11.2 | 107.6 | 183.1 | 192.6 |
| passed | total | 256 | 3797.4 | 16498.4 | 18698.7 | 19393.1 |
| runtime_error | queue | 15 | 1990.0 | 18379.7 | 18379.7 | 18379.7 |
| runtime_error | spawn | 15 | 387.9 | 492.2 | 492.2 | 492.2 |
| runtime_error | exec | 15 | 312.6 | 510.1 | 510.1 | 510.1 |
| runtime_error | total | 15 | 2690.4 | 19007.0 | 19007.0 | 19007.0 |
| timeout | queue | 15 | 3541.9 | 17889.8 | 17889.8 | 17889.8 |
| timeout | spawn | 15 | 391.9 | 505.8 | 505.8 | 505.8 |
| timeout | exec | 15 | 10013.2 | 10106.1 | 10106.1 | 10106.1 |
| timeout | total | 15 | 14034.5 | 28217.5 | 28217.5 | 28217.5 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 973.4 | 973.6 |
| 25 | 3012.6 | 3013.3 |
| 50 | 7011.2 | 6614.6 |
| 75 | 13388.2 | 12297.1 |
| 100 | 18920.1 | 17889.8 |

First k whose p95 queue wait passes 5000 ms: 39.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 6179.1 / 9368.6 / 12082.1 / 12388.7 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 4.1 / 5054.5 / 6099.8 / 12388.7 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 110 | 113.8 | 118 |
| ranking.updated | 69 | 69.0 | 70 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 47128 | 60 | 60 | 60 |
| ranking.updated | 28017 | 67455 | 121526 | 130647 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 49.84 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 117 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| setup | ranking | 37 | 0 | 0.00 / 0.00 / 0.01 | 1.16 / 89.92 / 90.50 | 4.63 / 84.38 / 86.43 | 8.30 / 81.43 / 82.80 |
| sse-ramp | heartbeat | 8 | 366 | 0.95 / 1.69 / 1.69 | — / — / — | — / — / — | — / — / — |
| sse-ramp | ranking | 1 | 17 | 0.50 / 0.50 / 0.50 | 1.22 / 1.22 / 1.22 | 3.03 / 3.03 / 3.03 | 8.42 / 8.42 / 8.42 |
| load | heartbeat | 90 | 400 | 1.93 / 2.90 / 71.05 | — / — / — | — / — / — | — / — / — |
| load | ranking | 68 | 400 | 2.27 / 66.74 / 82.65 | 1.13 / 13.13 / 83.07 | 10.41 / 88.27 / 94.67 | 12.20 / 86.81 / 93.20 |
| settle | heartbeat | 20 | 400 | 1.60 / 2.01 / 2.13 | — / — / — | — / — / — | — / — / — |
| storm | heartbeat | 5 | 400 | 1.13 / 1.72 / 1.72 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — the frame encoded once, in the first subscriber (#439), plus N writes of it queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.1 / 1.7 / 3.7 | 10.0 / 12.9 / 16.6 / 17.5 | 11.2 / 14.4 / 17.8 / 18.8 | 3 |
| load | 1 | 0.7 / 0.7 / 0.7 / 0.7 | 10.6 / 10.6 / 10.6 / 10.6 | 11.6 / 11.6 / 11.6 / 11.6 | 1 |
| storm | 400 | 150.2 / 155.9 / 156.1 / 156.3 | 2366.1 / 2633.1 / 2646.4 / 2651.3 | 2517.9 / 2782.2 / 2797.1 / 2801.2 | 397 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 6290 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 13839 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 246.5 / 291.3 / 302.7 / 304.0 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 396.1 / 431.2 / 434.2 / 434.9 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 3269.7 / 3926.7 / 3979.9 / 3989.9 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 3962 ms) |

