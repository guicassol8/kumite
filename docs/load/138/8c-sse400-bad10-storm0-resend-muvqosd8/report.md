# Load report: burst `muvqosd8`

**FAIL**

## Failures

- 2× network error on POST /submissions (load) not retried (23 retried), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":25}
- submission: 300 started, 298 completed (2 never finished)

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T21:05:58.177Z |
| ended | 2026-10-05T21:09:25.778Z |
| node | v24.21.0 |
| commit | b32ec95 |
| harness loadavg (1/5/15 min) at start | 1.35 / 1.48 / 1.48 |
| harness loadavg (1/5/15 min) at end | 3.06 / 2.11 / 1.72 |
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
| round | load-muvqosd8 (4e875375-2138-4cb2-a455-d1812031384b) |
| problem | 504bf833-96c2-481f-bb14-28d826cbf32a |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 1.9 | 280.8 | 67.2 | 28.1 | 28.1 | 0.008 | 0 | 0 | 30 |
| setup | 73.8 | 135.4 | 150.3 | 488.3 | 100.3 | 84.4 | 84.4 | 0.079 | 0 | 0 | 68 |
| sse-ramp | 8.0 | 32.7 | 39.2 | 308.0 | 124.9 | 11.1 | 11.1 | 0.302 | 0 | 396 | 8 |
| load | 91.0 | 185.2 | 203.6 | 676.4 | 205.8 | 522.2 | 522.2 | 0.351 | 92 | 400 | 19 |
| settle | 1.6 | 40.4 | 40.4 | 649.0 | 122.6 | 112.9 | 112.9 | 0.083 | 0 | 400 | 1 |
| storm | 3.0 | 109.6 | 130.5 | 650.3 | 327.3 | 43.7 | 43.7 | 0.723 | 0 | 400 | 2 |
| teardown | 0.1 | 31.0 | 31.0 | 644.6 | 105.9 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 5.6 | 36.4 | 36.4 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.0 | 28.6 | 28.6 | 0 |
| `POST /auth/login` | 1 | 200×1 | 98.3 | 98.3 | 98.3 | 98.3 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.9 | 3.9 | 3.9 | 3.9 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.6 | 4.6 | 4.6 | 4.6 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.6 | 5.6 | 5.6 | 5.6 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 16.5 | 16.5 | 16.5 | 16.5 | 0 |
| `GET /organizer/stats/live` | 68 | 200×68 | 80.4 | 291.6 | 405.2 | 405.2 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 77.6 | 292.8 | 407.0 | 407.0 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.4 | 13.0 | 13.0 | 13.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 492.3 | 590.3 | 599.6 | 680.7 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 498.1 | 591.5 | 600.4 | 603.7 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.9 | 4.9 | 4.9 | 4.9 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.3 | 6.9 | 6.9 | 6.9 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.8 | 9.8 | 9.8 | 9.8 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 9.2 | 9.2 | 9.2 | 9.2 | 0 |
| `POST /teams` | 100 | 201×100 | 8.7 | 14.9 | 17.6 | 19.2 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 11.7 | 18.2 | 49.8 | 53.7 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.2 | 21.6 | 21.6 | 21.6 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.3 | 21.6 | 21.6 | 21.6 | 0 |
| `GET /sse` | 400 | 200×400 | 2.4 | 3.1 | 14.6 | 27.2 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 20 | 200×19, network×1 | 109.1 | 27156.1 | 27156.1 | 27156.1 | 1 (0 timeouts) |
| `GET /organizer/stats/process` | 20 | 200×19, network×1 | 109.3 | 27156.6 | 27156.6 | 27156.6 | 1 (0 timeouts) |
| `POST /submissions` | 323 | 201×298, network×25 | 22265.4 | 28716.8 | 36919.0 | 38794.0 | 25 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 3.0 | 763.6 | 763.6 | 763.6 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 3.5 | 762.4 | 762.4 | 762.4 | 0 |
| `GET /ranking` | 3 | 200×3 | 7.1 | 1067.1 | 1067.1 | 1067.1 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 9.4 | 1067.7 | 1067.7 | 1067.7 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 77.4 | 814.8 | 814.8 | 814.8 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 79.7 | 814.6 | 814.6 | 814.6 | 0 |
| `GET /ranking` | 3 | 200×3 | 420.5 | 1647.9 | 1647.9 | 1647.9 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 430.9 | 1659.3 | 1659.3 | 1659.3 | 0 |
| `GET /sse` | 400 | 200×400 | 256.7 | 303.2 | 306.4 | 307.2 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 7.0 | 7.0 | 7.0 | 7.0 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 6.9 | 6.9 | 6.9 | 6.9 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 35.8 | 35.8 | 35.8 | 35.8 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

| phase | route | after | count |
| --- | --- | --- | --- |
| load | `GET /organizer/stats/live` | UND_ERR_SOCKET · request · reused | 1 |
| load | `GET /organizer/stats/process` | UND_ERR_SOCKET · request · reused | 1 |
| load | `POST /submissions` | UND_ERR_SOCKET · request · reused | 23 |

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 268 | 0 | 0 |
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
| submission | 300 | 298 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 268 | 22190.8 | 27689.1 | 28717.0 | 33180.6 |
| memory | 15 | 22818.0 | 27692.2 | 27692.2 | 27692.2 |
| loop | 15 | 33182.9 | 38794.0 | 38794.0 | 38794.0 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 298 |
| by outcome | passed×268, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 298 / 298 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 298 | 8394.6 | 18883.2 | 19873.6 | 20627.9 |
| all | spawn | 298 | 389.2 | 692.4 | 715.7 | 717.6 |
| all | exec | 298 | 11.6 | 9884.8 | 10097.7 | 10410.0 |
| all | total | 298 | 10927.0 | 19793.6 | 28089.1 | 29482.3 |
| passed | queue | 268 | 8889.1 | 18883.2 | 19873.6 | 20627.9 |
| passed | spawn | 268 | 388.6 | 692.4 | 715.7 | 717.6 |
| passed | exec | 268 | 10.1 | 188.8 | 396.2 | 431.0 |
| passed | total | 268 | 9193.0 | 19431.6 | 20192.3 | 20922.7 |
| runtime_error | queue | 15 | 5584.9 | 19871.0 | 19871.0 | 19871.0 |
| runtime_error | spawn | 15 | 402.1 | 695.1 | 695.1 | 695.1 |
| runtime_error | exec | 15 | 154.8 | 627.9 | 627.9 | 627.9 |
| runtime_error | total | 15 | 6214.4 | 20698.2 | 20698.2 | 20698.2 |
| timeout | queue | 15 | 6308.8 | 18809.6 | 18809.6 | 18809.6 |
| timeout | spawn | 15 | 376.6 | 621.2 | 621.2 | 621.2 |
| timeout | exec | 15 | 10016.6 | 10410.0 | 10410.0 | 10410.0 |
| timeout | total | 15 | 17015.4 | 29482.3 | 29482.3 | 29482.3 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1080.8 | 1082.4 |
| 25 | 3115.1 | 2803.4 |
| 50 | 8394.6 | 7519.4 |
| 75 | 15280.1 | 14853.1 |
| 100 | 20627.9 | 19095.5 |

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
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 8087.2 / 13871.3 / 14208.0 / 14263.2 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 4.4 / 5424.6 / 7591.6 / 14263.2 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 93 | 96.7 | 101 |
| ranking.updated | 77 | 77 | 77 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 39864 | 60 | 60 | 60 |
| ranking.updated | 31200 | 28022 | 82403 | 91762 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 35.00 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 73 | 0 | 0.00 / 0.01 / 0.02 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 358 | 0.39 / 0.73 / 0.73 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 91 | 400 | 0.83 / 1.38 / 72.57 | — / — / — | — / — / — | — / — / — |
| load | ranking | 75 | 400 | 198.98 / 306.18 / 323.94 | 1.28 / 90.83 / 94.81 | 17.83 / 91.64 / 96.41 | 5.34 / 71.15 / 80.38 |
| settle | heartbeat | 2 | 400 | 0.65 / 0.66 / 0.66 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 57.81 / 57.81 / 57.81 | 7.97 / 7.97 / 7.97 | 5.09 / 5.09 / 5.09 | 4.64 / 4.64 / 4.64 |
| storm | heartbeat | 3 | 400 | 0.69 / 0.76 / 0.76 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.0 / 1.5 / 4.2 | 5.4 / 6.9 / 10.1 / 12.2 | 6.4 / 8.2 / 11.7 / 14.4 | 2 |
| load | 1 | 0.7 / 0.7 / 0.7 / 0.7 | 5.1 / 5.1 / 5.1 / 5.1 | 6.0 / 6.0 / 6.0 / 6.0 | 1 |
| storm | 400 | 142.0 / 154.0 / 154.6 / 154.8 | 1375.0 / 1675.2 / 1691.8 / 1695.7 | 1506.6 / 1804.9 / 1822.8 / 1826.6 | 396 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 4 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 1603 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 256.7 / 303.2 / 306.4 / 307.2 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 399.0 / 433.7 / 437.2 / 438.6 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2126.7 / 2603.9 / 2643.2 / 2653.0 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2613 ms) |

