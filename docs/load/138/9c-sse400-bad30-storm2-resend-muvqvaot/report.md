# Load report: burst `muvqvaot`

**FAIL**

## Failures

- 7× network error on POST /submissions (load) not retried (22 retried), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":29}
- submission: 300 started, 293 completed (7 never finished)

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T21:11:01.857Z |
| ended | 2026-10-05T21:15:47.314Z |
| node | v24.21.0 |
| commit | b32ec95 |
| harness loadavg (1/5/15 min) at start | 1.03 / 1.68 / 1.61 |
| harness loadavg (1/5/15 min) at end | 3.60 / 2.83 / 2.10 |
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
| badFraction | 0.3 |
| memoryShare | 0.5 |
| problems | 5 |
| untilDone | true |
| storm | true |
| stormWindowSeconds | 2 |
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
| round | load-muvqvaot (acfd8b13-a6a5-4d28-a437-7d072d0251ed) |
| problem | 97fc4f42-aaa3-4bd8-9255-1d1eb8d864f4 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 1.9 | 280.2 | 67.2 | 4.5 | 4.5 | 0.008 | 0 | 0 | 30 |
| setup | 75.0 | 137.2 | 150.9 | 474.5 | 98.9 | 89.9 | 89.9 | 0.075 | 0 | 0 | 69 |
| sse-ramp | 8.0 | 35.1 | 54.3 | 299.6 | 111.2 | 10.0 | 10.0 | 0.271 | 0 | 368 | 8 |
| load | 167.2 | 191.1 | 206.2 | 704.5 | 204.4 | 703.4 | 707.9 | 0.335 | 96 | 400 | 39 |
| settle | 2.4 | 44.4 | 68.4 | 658.0 | 162.5 | 140.4 | 140.4 | 0.129 | 0 | 400 | 2 |
| storm | 2.6 | 102.4 | 119.9 | 650.5 | 174.6 | 10.9 | 10.9 | 0.809 | 0 | 344 | 2 |
| teardown | 0.1 | 95.4 | 95.4 | 658.0 | 225.2 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 5.7 | 18.3 | 18.3 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 5.4 | 10.4 | 10.4 | 0 |
| `POST /auth/login` | 1 | 200×1 | 89.9 | 89.9 | 89.9 | 89.9 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.1 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 5.1 | 5.1 | 5.1 | 5.1 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.9 | 4.9 | 4.9 | 4.9 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 17.2 | 17.2 | 17.2 | 17.2 | 0 |
| `GET /organizer/stats/live` | 69 | 200×69 | 84.3 | 307.3 | 387.6 | 387.6 | 0 |
| `GET /organizer/stats/process` | 69 | 200×69 | 82.8 | 307.2 | 387.1 | 387.1 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 18.6 | 21.0 | 21.0 | 21.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 491.8 | 592.7 | 678.0 | 799.1 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 498.2 | 594.2 | 609.5 | 800.8 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 13.0 | 13.5 | 13.5 | 13.5 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 5.9 | 6.9 | 6.9 | 6.9 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 12.3 | 12.3 | 12.3 | 12.3 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 9.5 | 9.5 | 9.5 | 9.5 | 0 |
| `POST /teams` | 100 | 201×100 | 15.3 | 49.8 | 52.0 | 52.1 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 15.8 | 50.2 | 52.3 | 53.2 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.4 | 3.9 | 3.9 | 3.9 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.4 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /sse` | 400 | 200×400 | 2.4 | 3.1 | 7.8 | 15.6 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 39 | 200×39 | 3.9 | 19985.0 | 27507.0 | 27507.0 | 0 |
| `GET /organizer/stats/process` | 40 | 200×39, network×1 | 3.8 | 19985.4 | 62291.8 | 62291.8 | 1 (0 timeouts) |
| `POST /submissions` | 322 | 201×293, network×29 | 48227.1 | 70166.9 | 77663.8 | 77664.0 | 29 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 6.3 | 15.4 | 15.4 | 15.4 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 6.3 | 15.3 | 15.3 | 15.3 | 0 |
| `GET /ranking` | 6 | 200×6 | 10.0 | 943.7 | 943.7 | 943.7 | 0 |
| `GET /rounds/:id/ranking` | 6 | 200×6 | 12.0 | 946.8 | 946.8 | 946.8 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 28.9 | 64.5 | 64.5 | 64.5 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 28.3 | 66.1 | 66.1 | 66.1 | 0 |
| `GET /ranking` | 2 | 200×2 | 6.0 | 204.6 | 204.6 | 204.6 | 0 |
| `GET /rounds/:id/ranking` | 2 | 200×2 | 8.4 | 256.0 | 256.0 | 256.0 | 0 |
| `GET /sse` | 400 | 200×400 | 32.1 | 58.1 | 65.1 | 72.9 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.1 | 6.1 | 6.1 | 6.1 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 6.6 | 6.6 | 6.6 | 6.6 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 39.7 | 39.7 | 39.7 | 39.7 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

| phase | route | after | count |
| --- | --- | --- | --- |
| load | `POST /submissions` | UND_ERR_SOCKET · request · reused | 22 |
| load | `GET /organizer/stats/process` | UND_ERR_SOCKET · request · reused | 1 |

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 205 | 0 | 0 |
| memory | 0 | 44 | 0 |
| loop | 0 | 0 | 44 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |
| submission | 300 | 293 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 205 | 47310.0 | 62351.4 | 77662.6 | 77664.1 |
| memory | 44 | 47319.1 | 62352.3 | 70169.2 | 70169.2 |
| loop | 44 | 57227.1 | 77663.3 | 77664.0 | 77664.0 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 293 |
| by outcome | passed×205, runtime_error×44, timeout×44 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.98 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 293 / 293 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 293 | 21399.3 | 44121.0 | 45818.1 | 47615.8 |
| all | spawn | 293 | 391.6 | 715.5 | 1078.3 | 1105.6 |
| all | exec | 293 | 13.2 | 10080.1 | 10253.2 | 10589.8 |
| all | total | 293 | 24013.7 | 47908.1 | 53998.6 | 56194.5 |
| passed | queue | 205 | 21492.6 | 44392.6 | 45589.8 | 47615.8 |
| passed | spawn | 205 | 391.8 | 701.4 | 923.2 | 1079.1 |
| passed | exec | 205 | 8.3 | 103.1 | 414.6 | 588.8 |
| passed | total | 205 | 22024.8 | 44905.0 | 45818.5 | 47908.1 |
| runtime_error | queue | 44 | 19508.0 | 43614.2 | 45103.2 | 45103.2 |
| runtime_error | spawn | 44 | 403.8 | 780.9 | 1078.3 | 1078.3 |
| runtime_error | exec | 44 | 203.8 | 672.6 | 712.8 | 712.8 |
| runtime_error | total | 44 | 20295.9 | 44214.9 | 45811.8 | 45811.8 |
| timeout | queue | 44 | 19410.3 | 43592.9 | 45818.1 | 45818.1 |
| timeout | spawn | 44 | 371.4 | 802.4 | 1105.6 | 1105.6 |
| timeout | exec | 44 | 10011.0 | 10253.2 | 10589.8 | 10589.8 |
| timeout | total | 44 | 30231.1 | 53998.6 | 56194.5 | 56194.5 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1201.4 | 1201.4 |
| 25 | 3697.1 | 3403.4 |
| 50 | 16509.4 | 16194.9 |
| 75 | 29813.1 | 29382.5 |
| 100 | 45103.2 | 44010.8 |

First k whose p95 queue wait passes 5000 ms: 32.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 24035.3 / 24988.8 / 27700.5 / 40285.5 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 3.9 / 5029.9 / 13935.1 / 40285.5 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 170 | 173.5 | 177 |
| ranking.updated | 121 | 121 | 121 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 70161 | 60 | 60 | 60 |
| ranking.updated | 48800 | 28022 | 82857 | 91623 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.95 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 75 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 7 | 350 | 0.39 / 0.74 / 0.74 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 168 | 400 | 0.99 / 1.49 / 75.23 | — / — / — | — / — / — | — / — / — |
| load | ranking | 119 | 400 | 205.88 / 315.14 / 391.15 | 1.35 / 76.63 / 178.54 | 18.44 / 89.13 / 104.04 | 5.02 / 71.13 / 85.17 |
| settle | heartbeat | 2 | 400 | 0.69 / 1.07 / 1.07 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 61.24 / 61.24 / 61.24 | 1.00 / 1.00 / 1.00 | 18.40 / 18.40 / 18.40 | 3.95 / 3.95 / 3.95 |
| storm | heartbeat | 3 | 400 | 0.54 / 0.81 / 0.81 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.0 / 1.3 / 3.9 | 5.4 / 6.7 / 8.2 / 9.2 | 6.4 / 8.0 / 9.6 / 10.9 | 1 |
| load | 1 | 1.0 / 1.0 / 1.0 / 1.0 | 6.1 / 6.1 / 6.1 / 6.1 | 7.3 / 7.3 / 7.3 / 7.3 | 1 |
| storm | 400 | 27.0 / 54.8 / 60.8 / 68.1 | 290.1 / 494.7 / 500.6 / 502.6 | 319.9 / 535.5 / 542.5 / 548.4 | 105 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2430 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 2 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 32.1 / 58.1 / 65.1 / 72.9 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 58.7 / 112.2 / 120.1 / 124.6 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 352.1 / 583.9 / 589.9 / 591.4 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 524 ms) |

