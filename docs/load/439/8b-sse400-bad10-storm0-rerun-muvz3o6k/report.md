# Load report: burst `muvz3o6k`

**FAIL**

## Failures

- 9× network error on POST /submissions (load), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":9}
- submission: 300 started, 291 completed (9 never finished)

## Run

| field | value |
| --- | --- |
| target | http://localhost:3439 |
| started | 2026-10-06T01:01:29.520Z |
| ended | 2026-10-06T01:05:02.044Z |
| node | v24.21.0 |
| commit | ef2964c |
| harness loadavg (1/5/15 min) at start | 0.81 / 1.25 / 1.68 |
| harness loadavg (1/5/15 min) at end | 3.53 / 2.09 / 1.88 |
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
| pastRounds | 0 |
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
| round | load-muvz3o6k (f94515d5-dfae-4d01-99a3-afe12f94de37) |
| problem | a6f4965c-ee00-401b-a46c-ab91a3c974cb |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 1.5 | 280.1 | 68.1 | 2.1 | 2.1 | 0.007 | 0 | 0 | 30 |
| setup | 73.7 | 136.3 | 148.9 | 476.0 | 100.6 | 96.6 | 96.6 | 0.062 | 0 | 0 | 67 |
| sse-ramp | 8.0 | 40.3 | 103.7 | 327.1 | 140.8 | 13.2 | 13.2 | 0.299 | 0 | 353 | 8 |
| load | 95.1 | 166.1 | 204.9 | 499.4 | 166.7 | 175.0 | 175.0 | 0.140 | 92 | 400 | 20 |
| settle | 1.7 | 32.8 | 32.8 | 437.3 | 133.4 | 14.3 | 14.3 | 0.032 | 0 | 400 | 1 |
| storm | 3.7 | 99.8 | 131.4 | 614.8 | 272.5 | 58.7 | 58.7 | 0.887 | 0 | 400 | 3 |
| teardown | 0.1 | 74.8 | 74.8 | 615.0 | 108.5 | 7.1 | 7.1 | 0.224 | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.6 | 5.8 | 16.7 | 16.7 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 6.2 | 9.0 | 9.0 | 0 |
| `POST /auth/login` | 1 | 200×1 | 89.5 | 89.5 | 89.5 | 89.5 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.2 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.7 | 4.7 | 4.7 | 4.7 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 16.4 | 16.4 | 16.4 | 16.4 | 0 |
| `GET /organizer/stats/live` | 67 | 200×67 | 84.0 | 303.3 | 315.6 | 315.6 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 85.8 | 303.1 | 316.0 | 316.0 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 8.9 | 11.5 | 11.5 | 11.5 | 0 |
| `POST /auth/login` | 300 | 200×300 | 493.5 | 588.8 | 603.5 | 688.2 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 495.8 | 591.9 | 599.6 | 604.1 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.6 | 4.6 | 4.6 | 4.6 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 5.8 | 7.4 | 7.4 | 7.4 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.6 | 9.6 | 9.6 | 9.6 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 7.7 | 7.7 | 7.7 | 7.7 | 0 |
| `POST /teams` | 100 | 201×100 | 7.8 | 12.9 | 14.6 | 14.7 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.8 | 16.0 | 17.9 | 23.0 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.4 | 8.4 | 8.4 | 8.4 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.4 | 8.3 | 8.3 | 8.3 | 0 |
| `GET /sse` | 400 | 200×400 | 2.5 | 3.1 | 9.9 | 23.0 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 20 | 200×20 | 13.3 | 20460.0 | 30593.4 | 30593.4 | 0 |
| `GET /organizer/stats/process` | 20 | 200×20 | 13.1 | 20460.5 | 30594.1 | 30594.1 | 0 |
| `POST /submissions` | 300 | 201×291, network×9 | 25648.6 | 31857.4 | 38696.2 | 42517.6 | 9 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 2.3 | 916.8 | 916.8 | 916.8 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 2.5 | 905.2 | 905.2 | 905.2 | 0 |
| `GET /ranking` | 3 | 200×3 | 6.8 | 907.4 | 907.4 | 907.4 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 9.6 | 911.0 | 911.0 | 911.0 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 70.4 | 107.8 | 107.8 | 107.8 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 72.3 | 107.6 | 107.6 | 107.6 | 0 |
| `GET /ranking` | 3 | 200×3 | 507.0 | 2017.1 | 2017.1 | 2017.1 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 721.1 | 2017.7 | 2017.7 | 2017.7 | 0 |
| `GET /sse` | 400 | 200×400 | 283.6 | 326.0 | 332.6 | 333.8 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 49.4 | 49.4 | 49.4 | 49.4 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 262 | 0 | 0 |
| memory | 0 | 15 | 0 |
| loop | 0 | 0 | 14 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |
| submission | 300 | 291 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 262 | 23280.5 | 31280.1 | 31892.9 | 32773.8 |
| memory | 15 | 25649.6 | 34025.6 | 34025.6 | 34025.6 |
| loop | 14 | 34050.5 | 42517.7 | 42517.7 | 42517.7 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 291 |
| by outcome | passed×262, runtime_error×15, timeout×14 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 0.99 |
| workers spawned / exited / alive at the end | 291 / 291 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 291 | 4120.4 | 19174.3 | 21315.0 | 21788.5 |
| all | spawn | 291 | 402.1 | 588.8 | 692.7 | 776.7 |
| all | exec | 291 | 17.0 | 497.4 | 10095.3 | 10107.9 |
| all | total | 291 | 5280.1 | 20398.2 | 26817.1 | 28586.7 |
| passed | queue | 262 | 4117.7 | 19105.2 | 21294.3 | 21689.7 |
| passed | spawn | 262 | 401.1 | 588.8 | 692.7 | 776.7 |
| passed | exec | 262 | 14.4 | 116.8 | 190.0 | 202.6 |
| passed | total | 262 | 4530.5 | 19502.2 | 21704.1 | 22099.1 |
| runtime_error | queue | 15 | 4097.0 | 21788.5 | 21788.5 | 21788.5 |
| runtime_error | spawn | 15 | 409.9 | 501.3 | 501.3 | 501.3 |
| runtime_error | exec | 15 | 322.2 | 497.4 | 497.4 | 497.4 |
| runtime_error | total | 15 | 5003.5 | 22695.8 | 22695.8 | 22695.8 |
| timeout | queue | 14 | 4398.8 | 18186.7 | 18186.7 | 18186.7 |
| timeout | spawn | 14 | 407.7 | 590.5 | 590.5 | 590.5 |
| timeout | exec | 14 | 10031.9 | 10107.9 | 10107.9 | 10107.9 |
| timeout | total | 14 | 14915.4 | 28586.7 | 28586.7 | 28586.7 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1100.7 | 1102.8 |
| 25 | 3206.9 | 2891.4 |
| 50 | 7603.5 | 7213.6 |
| 75 | 15892.4 | 14732.6 |
| 100 | 21788.5 | 20814.2 |

First k whose p95 queue wait passes 5000 ms: 38.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 11571.8 / 15761.0 / 19602.0 / 19693.7 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 3.9 / 5049.9 / 10592.0 / 19693.7 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 97 | 100.8 | 105 |
| ranking.updated | 70 | 70 | 70 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 41928 | 60 | 60 | 60 |
| ranking.updated | 28400 | 28022 | 81525 | 91740 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 35.00 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 73 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 366 | 0.89 / 1.30 / 1.30 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 95 | 400 | 1.93 / 4.38 / 77.72 | — / — / — | — / — / — | — / — / — |
| load | ranking | 68 | 400 | 2.44 / 3.89 / 81.24 | 7.97 / 88.31 / 92.33 | 17.38 / 94.74 / 187.86 | 5.96 / 80.10 / 111.55 |
| settle | heartbeat | 2 | 400 | 1.39 / 1.68 / 1.68 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 1.62 / 1.62 / 1.62 | 8.77 / 8.77 / 8.77 | 4.57 / 4.57 / 4.57 | 3.71 / 3.71 / 3.71 |
| storm | heartbeat | 4 | 400 | 0.20 / 1.37 / 1.37 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — the frame encoded once, in the first subscriber (#439), plus N writes of it queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.2 / 4.4 / 6.4 | 5.7 / 7.5 / 9.9 / 13.3 | 6.7 / 9.1 / 12.5 / 14.2 | 2 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 5.3 / 5.3 / 5.3 / 5.3 | 6.4 / 6.4 / 6.4 / 6.4 | 1 |
| storm | 400 | 162.6 / 167.0 / 168.5 / 169.1 | 1942.2 / 2265.2 / 2284.5 / 2355.6 | 2106.3 / 2428.8 / 2440.5 / 2519.7 | 396 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 1734 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 283.6 / 326.0 / 332.6 / 333.8 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 436.5 / 486.9 / 489.4 / 491.5 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2707.7 / 3280.7 / 3321.1 / 3348.4 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 3265 ms) |

