# Load report: burst `muvylihe`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-06T00:47:22.326Z |
| ended | 2026-10-06T00:51:13.036Z |
| node | v24.21.0 |
| commit | c443ec8 |
| harness loadavg (1/5/15 min) at start | 0.99 / 1.78 / 2.28 |
| harness loadavg (1/5/15 min) at end | 1.19 / 1.54 / 2.06 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3277 |
| teams | 100 |
| members | 3 |
| sse | 0 |
| submissions | 300 |
| badFraction | 0.3 |
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
| out | /home/guilherme/code/kumite/.claude/worktrees/agent-a9d23f5e257db0a02/load-results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvylihe (918f70ca-b8f8-4a24-bb99-f6aa4c2dbe53) |
| problem | a69e5dee-18cd-4c48-98b1-58612fe44243 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 1.9 | 281.1 | 79.7 | 2.4 | 2.4 | 0.007 | 0 | 0 | 30 |
| setup | 75.1 | 132.8 | 147.7 | 474.2 | 99.3 | 182.1 | 182.1 | 0.078 | 0 | 0 | 69 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 125.4 | 193.1 | 204.9 | 467.1 | 106.1 | 68.3 | 77.1 | 0.045 | 96 | 0 | 124 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.1 | 85.8 | 85.8 | 361.6 | 76.4 | 0.7 | 0.7 | 0.034 | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 6.8 | 17.0 | 17.0 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 6.5 | 9.8 | 9.8 | 0 |
| `POST /auth/login` | 1 | 200×1 | 82.2 | 82.2 | 82.2 | 82.2 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 3.9 | 3.9 | 3.9 | 3.9 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.6 | 5.6 | 5.6 | 5.6 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.6 | 15.6 | 15.6 | 15.6 | 0 |
| `GET /organizer/stats/live` | 69 | 200×69 | 80.8 | 286.9 | 383.9 | 383.9 | 0 |
| `GET /organizer/stats/process` | 69 | 200×69 | 82.3 | 287.5 | 383.4 | 383.4 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 21.1 | 22.7 | 22.7 | 22.7 | 0 |
| `POST /auth/login` | 300 | 200×300 | 486.5 | 591.3 | 608.2 | 679.7 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 498.4 | 604.1 | 686.4 | 779.7 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 10.9 | 14.5 | 14.5 | 14.5 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.8 | 7.7 | 7.7 | 7.7 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 10.0 | 10.0 | 10.0 | 10.0 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 9.2 | 9.2 | 9.2 | 9.2 | 0 |
| `POST /teams` | 100 | 201×100 | 20.3 | 46.8 | 58.0 | 58.0 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 20.1 | 51.0 | 56.6 | 57.2 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 124 | 200×124 | 3.0 | 56.9 | 62.0 | 808.4 | 0 |
| `GET /organizer/stats/process` | 124 | 200×124 | 2.9 | 56.7 | 61.7 | 190.7 | 0 |
| `POST /submissions` | 300 | 201×300 | 32175.4 | 43006.4 | 45912.9 | 46201.7 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.2 | 2.2 | 2.2 | 2.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /ranking` | 1 | 200×1 | 14.8 | 14.8 | 14.8 | 14.8 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 14.5 | 14.5 | 14.5 | 14.5 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 8.6 | 8.6 | 8.6 | 8.6 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.5 | 7.5 | 7.5 | 7.5 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 51.1 | 51.1 | 51.1 | 51.1 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 210 | 0 | 0 |
| memory | 0 | 45 | 0 |
| loop | 0 | 0 | 45 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |
| submission | 300 | 300 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 210 | 28775.2 | 36214.5 | 36394.6 | 36404.7 |
| memory | 45 | 28506.9 | 36024.8 | 36189.2 | 36189.2 |
| loop | 45 | 38227.6 | 46020.2 | 46201.8 | 46201.8 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×210, runtime_error×45, timeout×45 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0 / 0.98 / 0.99 |
| workers spawned / exited / alive / idle at the end | 48 / 45 / 3 / 3 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 28424.0 | 35994.0 | 36291.1 | 36313.7 |
| all | spawn | 300 | 0 | 281.3 | 388.5 | 468.2 |
| all | exec | 300 | 5.3 | 10005.4 | 10008.9 | 10121.9 |
| all | total | 300 | 30612.0 | 41502.0 | 45892.8 | 46188.6 |
| passed | queue | 210 | 28618.6 | 36026.4 | 36307.9 | 36313.7 |
| passed | spawn | 210 | 0 | 286.9 | 399.1 | 468.2 |
| passed | exec | 210 | 4.0 | 79.3 | 100.3 | 194.5 |
| passed | total | 210 | 28623.8 | 36183.1 | 36311.3 | 36317.6 |
| runtime_error | queue | 45 | 28309.1 | 35726.9 | 35973.9 | 35973.9 |
| runtime_error | spawn | 45 | 0 | 0 | 0 | 0 |
| runtime_error | exec | 45 | 182.3 | 204.0 | 288.4 | 288.4 |
| runtime_error | total | 45 | 28491.3 | 35904.4 | 36105.3 | 36105.3 |
| timeout | queue | 45 | 28112.6 | 35887.8 | 36183.6 | 36183.6 |
| timeout | spawn | 45 | 0 | 276.4 | 378.5 | 378.5 |
| timeout | exec | 45 | 10005.1 | 10067.9 | 10121.9 | 10121.9 |
| timeout | total | 45 | 38129.7 | 45996.9 | 46188.6 | 46188.6 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 483.5 | 560.8 |
| 25 | 9712.8 | 9724.4 |
| 50 | 11199.5 | 10908.2 |
| 75 | 21086.6 | 21083.0 |
| 100 | 31998.8 | 31691.9 |

First k whose p95 queue wait passes 5000 ms: 24.

## SSE

| field | value |
| --- | --- |
| requested | 0 |
| opened | 0 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 0 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | — / — / — / — |
| heartbeat interval ms (p50 / p95 / p99 / max) | — / — / — / — |

| event | per connection min | mean | max |
| --- | --- | --- | --- |

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 75 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 125 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 40 | 0 | 0.00 / 0.00 / 0.00 | 1.01 / 1.31 / 1.55 | 4.03 / 5.03 / 5.17 | 3.77 / 5.77 / 76.02 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 3, idle 3) |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 23 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 0 over 0 s |
| opened | 0 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | — / — / — / — |
| to the first state.sync ms (p50 / p95 / p99 / max) | — / — / — / — |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | — / — / — / — |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 13 ms) |

