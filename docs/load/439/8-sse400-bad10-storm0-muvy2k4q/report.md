# Load report: burst `muvy2k4q`

**FAIL**

## Failures

- 11× network error on POST /submissions (load), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":11}
- submission: 300 started, 289 completed (11 never finished)

## Run

| field | value |
| --- | --- |
| target | http://localhost:3439 |
| started | 2026-10-06T00:32:37.998Z |
| ended | 2026-10-06T00:36:03.246Z |
| node | v24.21.0 |
| commit | ef2964c |
| harness loadavg (1/5/15 min) at start | 0.86 / 2.90 / 3.05 |
| harness loadavg (1/5/15 min) at end | 3.37 / 3.12 / 3.08 |
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
| round | load-muvy2k4q (8a59d28f-1d1d-4ad0-ac03-96e01f386401) |
| problem | 329f9a88-2d6f-49b5-8fb0-68b73adf36a3 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.2 | 1.8 | 295.6 | 68.1 | 3.2 | 3.2 | 0.008 | 0 | 0 | 30 |
| setup | 75.7 | 135.8 | 152.1 | 491.6 | 100.6 | 89.7 | 89.7 | 0.085 | 0 | 0 | 70 |
| sse-ramp | 8.0 | 40.6 | 78.0 | 329.6 | 110.3 | 6.3 | 6.3 | 0.295 | 0 | 372 | 8 |
| load | 88.2 | 192.5 | 206.8 | 543.1 | 178.4 | 184.8 | 184.8 | 0.124 | 96 | 400 | 20 |
| settle | 0.0 | 129.8 | 129.8 | 512.4 | 169.8 | — | — | — | 0 | 400 | 1 |
| storm | 3.1 | 103.3 | 125.5 | 596.1 | 285.3 | 39.5 | 39.5 | 0.736 | 0 | 400 | 2 |
| teardown | 0.1 | 28.7 | 28.7 | 606.8 | 263.6 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.6 | 5.5 | 17.7 | 17.7 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.5 | 6.5 | 9.3 | 9.3 | 0 |
| `POST /auth/login` | 1 | 200×1 | 88.7 | 88.7 | 88.7 | 88.7 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.1 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.8 | 5.8 | 5.8 | 5.8 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 17.1 | 17.1 | 17.1 | 17.1 | 0 |
| `GET /organizer/stats/live` | 70 | 200×70 | 82.3 | 307.9 | 406.1 | 406.1 | 0 |
| `GET /organizer/stats/process` | 70 | 200×70 | 84.0 | 306.1 | 406.1 | 406.1 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.8 | 11.1 | 11.1 | 11.1 | 0 |
| `POST /auth/login` | 300 | 200×300 | 490.5 | 586.2 | 602.4 | 681.0 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 506.6 | 603.6 | 689.5 | 709.5 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.9 | 4.9 | 4.9 | 4.9 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 7.1 | 7.7 | 7.7 | 7.7 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 11.4 | 11.4 | 11.4 | 11.4 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.9 | 8.9 | 8.9 | 8.9 | 0 |
| `POST /teams` | 100 | 201×100 | 7.4 | 10.5 | 15.1 | 15.8 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.8 | 15.9 | 23.5 | 27.2 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.2 | 5.5 | 5.5 | 5.5 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.4 | 4.8 | 4.8 | 4.8 | 0 |
| `GET /sse` | 400 | 200×400 | 2.7 | 3.9 | 8.2 | 16.7 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 20 | 200×20 | 85.8 | 9814.0 | 12994.7 | 12994.7 | 0 |
| `GET /organizer/stats/process` | 20 | 200×20 | 85.4 | 12992.7 | 13015.4 | 13015.4 | 0 |
| `POST /submissions` | 300 | 201×289, network×11 | 21781.3 | 32380.1 | 35206.0 | 38067.8 | 11 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 28.0 | 3701.6 | 3701.6 | 3701.6 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 26.3 | 3701.5 | 3701.5 | 3701.5 | 0 |
| `GET /ranking` | 1 | 200×1 | 6.4 | 6.4 | 6.4 | 6.4 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.6 | 8.6 | 8.6 | 8.6 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 215.3 | 414.8 | 414.8 | 414.8 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 214.8 | 415.6 | 415.6 | 415.6 | 0 |
| `GET /ranking` | 3 | 200×3 | 386.1 | 1690.7 | 1690.7 | 1690.7 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 442.2 | 1691.1 | 1691.1 | 1691.1 | 0 |
| `GET /sse` | 400 | 200×400 | 286.0 | 326.8 | 334.8 | 335.7 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.0 | 6.0 | 6.0 | 6.0 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 6.3 | 6.3 | 6.3 | 6.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 41.6 | 41.6 | 41.6 | 41.6 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 260 | 0 | 0 |
| memory | 0 | 14 | 0 |
| loop | 0 | 0 | 15 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |
| submission | 300 | 289 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 260 | 21584.8 | 30717.2 | 32973.4 | 34107.5 |
| memory | 14 | 22334.8 | 32380.4 | 32380.4 | 32380.4 |
| loop | 15 | 32174.3 | 38067.8 | 38067.8 | 38067.8 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 289 |
| by outcome | passed×260, runtime_error×14, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.96 / 0.98 / 0.99 |
| workers spawned / exited / alive at the end | 289 / 289 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 289 | 8810.3 | 18786.7 | 20388.3 | 20776.7 |
| all | spawn | 289 | 397.7 | 564.1 | 598.6 | 603.9 |
| all | exec | 289 | 71.8 | 10008.6 | 10084.1 | 10117.0 |
| all | total | 289 | 10003.0 | 19694.7 | 27981.2 | 28909.4 |
| passed | queue | 260 | 8668.4 | 18775.7 | 20293.2 | 20772.0 |
| passed | spawn | 260 | 396.7 | 561.9 | 592.9 | 603.9 |
| passed | exec | 260 | 14.3 | 114.5 | 193.0 | 209.8 |
| passed | total | 260 | 8980.4 | 19191.2 | 20773.2 | 21091.7 |
| runtime_error | queue | 14 | 9365.8 | 20776.7 | 20776.7 | 20776.7 |
| runtime_error | spawn | 14 | 322.2 | 598.6 | 598.6 | 598.6 |
| runtime_error | exec | 14 | 293.9 | 503.8 | 503.8 | 503.8 |
| runtime_error | total | 14 | 9885.2 | 21283.4 | 21283.4 | 21283.4 |
| timeout | queue | 15 | 7703.2 | 18502.9 | 18502.9 | 18502.9 |
| timeout | spawn | 15 | 405.3 | 508.3 | 508.3 | 508.3 |
| timeout | exec | 15 | 10013.1 | 10117.0 | 10117.0 | 10117.0 |
| timeout | total | 15 | 18203.4 | 28909.4 | 28909.4 | 28909.4 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1176.5 | 1176.5 |
| 25 | 3398.6 | 2870.0 |
| 50 | 7718.8 | 7398.1 |
| 75 | 15674.9 | 14698.7 |
| 100 | 20776.7 | 19982.4 |

First k whose p95 queue wait passes 5000 ms: 36.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 10615.8 / 12488.1 / 14079.3 / 14158.8 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 18.8 / 5449.1 / 9700.4 / 14158.8 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 88 | 91.9 | 96 |
| ranking.updated | 58 | 58 | 58 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 37565 | 60 | 60 | 60 |
| ranking.updated | 23600 | 28022 | 80782 | 91749 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 35.00 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 75 | 0 | 0.00 / 0.01 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 370 | 0.85 / 1.91 / 1.91 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 88 | 400 | 1.99 / 2.93 / 5.05 | — / — / — | — / — / — | — / — / — |
| load | ranking | 57 | 400 | 2.50 / 11.63 / 60.74 | 7.66 / 94.18 / 1592.55 | 19.55 / 98.84 / 118.76 | 5.32 / 76.98 / 79.63 |
| storm | heartbeat | 3 | 400 | 0.25 / 1.03 / 1.03 | — / — / — | — / — / — | — / — / — |
| teardown | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — the frame encoded once, in the first subscriber (#439), plus N writes of it queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.9 / 1.2 / 3.6 / 14.7 | 5.9 / 8.6 / 10.4 / 14.8 | 7.0 / 10.5 / 14.8 / 24.3 | 2 |
| load | 1 | 1.0 / 1.0 / 1.0 / 1.0 | 6.3 / 6.3 / 6.3 / 6.3 | 7.6 / 7.6 / 7.6 / 7.6 | 1 |
| storm | 400 | 140.2 / 153.7 / 154.5 / 154.6 | 1438.8 / 1680.6 / 1703.2 / 1707.4 | 1577.3 / 1812.4 / 1831.4 / 1835.0 | 395 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 28 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 14 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 286.0 / 326.8 / 334.8 / 335.7 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 429.1 / 458.3 / 460.5 / 461.7 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2195.7 / 2668.3 / 2711.3 / 2721.0 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2654 ms) |

