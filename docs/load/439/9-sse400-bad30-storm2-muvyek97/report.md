# Load report: burst `muvyek97`

**FAIL**

## Failures

- 15× network error on POST /submissions (load), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":15}
- submission: 300 started, 285 completed (15 never finished)

## Run

| field | value |
| --- | --- |
| target | http://localhost:3439 |
| started | 2026-10-06T00:41:58.032Z |
| ended | 2026-10-06T00:46:23.073Z |
| node | v24.21.0 |
| commit | ef2964c |
| harness loadavg (1/5/15 min) at start | 0.76 / 1.74 / 2.44 |
| harness loadavg (1/5/15 min) at end | 2.32 / 2.13 / 2.41 |
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
| badFraction | 0.3 |
| memoryShare | 0.5 |
| problems | 5 |
| untilDone | true |
| storm | true |
| stormWindowSeconds | 2 |
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
| round | load-muvyek97 (56ccc4c8-390a-4aba-8f79-a83f5de15523) |
| problem | 63eab4c6-87fb-4873-af1f-1ba52780668c |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.8 | 1.3 | 280.1 | 68.0 | 1.1 | 1.1 | 0.006 | 0 | 0 | 30 |
| setup | 75.6 | 135.9 | 152.6 | 475.6 | 100.4 | 88.8 | 88.8 | 0.086 | 0 | 0 | 69 |
| sse-ramp | 8.0 | 44.0 | 93.4 | 308.6 | 117.4 | 15.9 | 15.9 | 0.308 | 0 | 353 | 8 |
| load | 146.5 | 187.3 | 207.6 | 624.7 | 144.7 | 100.8 | 123.6 | 0.114 | 95 | 400 | 46 |
| settle | 2.2 | 14.5 | 23.8 | 419.9 | 137.1 | 8.5 | 8.5 | 0.039 | 0 | 400 | 2 |
| storm | 2.5 | 108.1 | 130.5 | 440.6 | 164.8 | 35.2 | 35.2 | 0.779 | 0 | 342 | 2 |
| teardown | 0.1 | 90.9 | 90.9 | 464.8 | 202.7 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 5.2 | 15.5 | 15.5 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 6.1 | 8.4 | 8.4 | 0 |
| `POST /auth/login` | 1 | 200×1 | 78.7 | 78.7 | 78.7 | 78.7 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.9 | 3.9 | 3.9 | 3.9 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 5.0 | 5.0 | 5.0 | 5.0 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.6 | 5.6 | 5.6 | 5.6 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 17.2 | 17.2 | 17.2 | 17.2 | 0 |
| `GET /organizer/stats/live` | 69 | 200×69 | 87.4 | 214.5 | 404.7 | 404.7 | 0 |
| `GET /organizer/stats/process` | 69 | 200×69 | 86.6 | 215.2 | 404.5 | 404.5 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.2 | 11.9 | 11.9 | 11.9 | 0 |
| `POST /auth/login` | 300 | 200×300 | 494.0 | 599.6 | 685.0 | 714.5 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 501.3 | 597.9 | 605.4 | 689.8 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.5 | 6.7 | 6.7 | 6.7 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.0 | 7.1 | 7.1 | 7.1 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 10.6 | 10.6 | 10.6 | 10.6 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 10.3 | 10.3 | 10.3 | 10.3 | 0 |
| `POST /teams` | 100 | 201×100 | 9.0 | 29.0 | 69.3 | 69.5 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 12.1 | 21.0 | 49.9 | 58.6 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.5 | 9.1 | 9.1 | 9.1 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.4 | 8.5 | 8.5 | 8.5 | 0 |
| `GET /sse` | 400 | 200×400 | 2.6 | 4.1 | 10.2 | 18.6 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 46 | 200×46 | 4.6 | 10234.4 | 20642.3 | 20642.3 | 0 |
| `GET /organizer/stats/process` | 46 | 200×46 | 5.0 | 10216.2 | 43304.6 | 43304.6 | 0 |
| `POST /submissions` | 300 | 201×285, network×15 | 44631.3 | 59461.3 | 64460.9 | 73443.3 | 15 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 2.7 | 11.2 | 11.2 | 11.2 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 2.6 | 11.2 | 11.2 | 11.2 | 0 |
| `GET /ranking` | 6 | 200×6 | 6.0 | 374.8 | 374.8 | 374.8 | 0 |
| `GET /rounds/:id/ranking` | 6 | 200×6 | 8.0 | 375.8 | 375.8 | 375.8 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 17.5 | 46.1 | 46.1 | 46.1 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 17.0 | 46.6 | 46.6 | 46.6 | 0 |
| `GET /ranking` | 2 | 200×2 | 6.4 | 171.6 | 171.6 | 171.6 | 0 |
| `GET /rounds/:id/ranking` | 2 | 200×2 | 8.5 | 194.4 | 194.4 | 194.4 | 0 |
| `GET /sse` | 400 | 200×400 | 28.4 | 53.2 | 88.3 | 92.3 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.1 | 6.1 | 6.1 | 6.1 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 8.4 | 8.4 | 8.4 | 8.4 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 36.1 | 36.1 | 36.1 | 36.1 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 200 | 0 | 0 |
| memory | 0 | 42 | 0 |
| loop | 0 | 0 | 43 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |
| submission | 300 | 285 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 200 | 44214.3 | 53846.5 | 59462.2 | 59836.9 |
| memory | 42 | 43817.0 | 59421.2 | 59773.5 | 59773.5 |
| loop | 43 | 53149.8 | 64461.1 | 73443.4 | 73443.4 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 285 |
| by outcome | passed×200, runtime_error×42, timeout×43 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.98 / 0.99 |
| workers spawned / exited / alive at the end | 285 / 285 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 285 | 29099.2 | 42005.4 | 44794.5 | 45391.1 |
| all | spawn | 285 | 314.5 | 476.4 | 501.2 | 584.8 |
| all | exec | 285 | 21.2 | 10013.1 | 10080.9 | 10088.9 |
| all | total | 285 | 30088.3 | 46819.8 | 51711.8 | 52522.2 |
| passed | queue | 200 | 29183.0 | 42003.4 | 42915.2 | 45085.2 |
| passed | spawn | 200 | 314.4 | 476.1 | 492.5 | 499.2 |
| passed | exec | 200 | 9.5 | 93.0 | 108.7 | 192.9 |
| passed | total | 200 | 29497.3 | 42494.6 | 43297.6 | 45391.9 |
| runtime_error | queue | 42 | 27420.3 | 42404.1 | 45391.1 | 45391.1 |
| runtime_error | spawn | 42 | 310.9 | 415.3 | 584.8 | 584.8 |
| runtime_error | exec | 42 | 233.8 | 386.8 | 418.1 | 418.1 |
| runtime_error | total | 42 | 27932.6 | 43096.3 | 45897.1 | 45897.1 |
| timeout | queue | 43 | 28302.6 | 41390.0 | 42106.9 | 42106.9 |
| timeout | spawn | 43 | 329.7 | 493.9 | 502.8 | 502.8 |
| timeout | exec | 43 | 10011.8 | 10080.9 | 10088.9 | 10088.9 |
| timeout | total | 43 | 38611.9 | 51711.8 | 52522.2 | 52522.2 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 926.7 | 946.9 |
| 25 | 3993.8 | 3696.2 |
| 50 | 17199.9 | 16819.0 |
| 75 | 29700.5 | 28812.7 |
| 100 | 45391.1 | 38807.2 |

First k whose p95 queue wait passes 5000 ms: 27.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 12746.3 / 23178.3 / 23802.8 / 23920.3 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 5.7 / 4318.9 / 11304.8 / 23920.3 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 149 | 152.8 | 157 |
| ranking.updated | 103 | 103 | 103 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 61570 | 60 | 60 | 60 |
| ranking.updated | 41600 | 28022 | 81696 | 91536 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.92 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 75 | 0 | 0.00 / 0.00 / 0.02 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 366 | 0.83 / 1.45 / 1.45 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 147 | 400 | 1.96 / 4.59 / 71.06 | — / — / — | — / — / — | — / — / — |
| load | ranking | 101 | 400 | 2.06 / 4.59 / 67.35 | 1.41 / 78.63 / 92.63 | 17.25 / 86.12 / 171.11 | 4.57 / 61.22 / 74.01 |
| settle | heartbeat | 2 | 400 | 1.16 / 1.66 / 1.66 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 1.57 / 1.57 / 1.57 | 0.86 / 0.86 / 0.86 | 9.75 / 9.75 / 9.75 | 3.01 / 3.01 / 3.01 |
| storm | heartbeat | 2 | 321 | 0.47 / 1.16 / 1.16 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — the frame encoded once, in the first subscriber (#439), plus N writes of it queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.9 / 1.4 / 2.2 / 3.5 | 5.7 / 9.7 / 12.2 / 20.7 | 6.8 / 11.1 / 13.9 / 24.6 | 2 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 5.9 / 5.9 / 5.9 / 5.9 | 7.0 / 7.0 / 7.0 / 7.0 | 1 |
| storm | 400 | 23.5 / 44.8 / 51.7 / 86.9 | 292.8 / 397.8 / 403.0 / 405.3 | 322.5 / 433.0 / 439.9 / 442.2 | 89 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2203 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 2 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 28.4 / 53.2 / 88.3 / 92.3 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 55.2 / 94.3 / 110.1 / 117.3 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 380.2 / 476.2 / 479.8 / 480.5 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 462 ms) |

