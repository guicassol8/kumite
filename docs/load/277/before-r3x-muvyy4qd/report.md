# Load report: burst `muvyy4qd`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-06T00:57:11.034Z |
| ended | 2026-10-06T01:01:15.738Z |
| node | v24.21.0 |
| commit | a9beaf8 |
| harness loadavg (1/5/15 min) at start | 0.93 / 1.53 / 1.89 |
| harness loadavg (1/5/15 min) at end | 0.94 / 1.30 / 1.70 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/37b2e0a4-59bf-4e73-a068-cc9e38cfbb0d/scratchpad/before/load-results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvyy4qd (5ab82a8a-f559-43ce-931f-78e9f86ed4cb) |
| problem | cd55602a-d4c1-494d-8c95-a81a545a078c |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 2.1 | 279.8 | 76.2 | 32.2 | 32.2 | 0.007 | 0 | 0 | 30 |
| setup | 72.4 | 132.5 | 146.3 | 474.5 | 100.7 | 90.4 | 90.4 | 0.075 | 0 | 0 | 67 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 142.2 | 195.8 | 206.4 | 515.7 | 145.1 | 82.3 | 90.1 | 0.051 | 96 | 0 | 140 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 99.3 | 99.3 | 260.0 | 55.4 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.6 | 7.1 | 20.0 | 20.0 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 6.9 | 10.4 | 10.4 | 0 |
| `POST /auth/login` | 1 | 200×1 | 129.2 | 129.2 | 129.2 | 129.2 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.0 | 4.0 | 4.0 | 4.0 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.0 | 4.0 | 4.0 | 4.0 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.9 | 4.9 | 4.9 | 4.9 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.9 | 15.9 | 15.9 | 15.9 | 0 |
| `GET /organizer/stats/live` | 67 | 200×67 | 80.1 | 298.5 | 397.1 | 397.1 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 80.8 | 297.7 | 398.1 | 398.1 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.3 | 13.4 | 13.4 | 13.4 | 0 |
| `POST /auth/login` | 300 | 200×300 | 481.5 | 579.5 | 591.3 | 615.7 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 497.6 | 597.2 | 613.1 | 662.6 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.1 | 5.9 | 5.9 | 5.9 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.4 | 8.6 | 8.6 | 8.6 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.2 | 9.2 | 9.2 | 9.2 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.6 | 8.6 | 8.6 | 8.6 | 0 |
| `POST /teams` | 100 | 201×100 | 8.0 | 12.2 | 14.4 | 15.2 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 11.0 | 16.4 | 21.0 | 23.5 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 140 | 200×140 | 3.2 | 61.0 | 69.9 | 305.0 | 0 |
| `GET /organizer/stats/process` | 140 | 200×140 | 3.2 | 61.8 | 69.9 | 304.5 | 0 |
| `POST /submissions` | 300 | 201×300 | 37488.1 | 49528.7 | 50603.5 | 50853.4 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.2 | 2.2 | 2.2 | 2.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /ranking` | 1 | 200×1 | 7.4 | 7.4 | 7.4 | 7.4 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 9.9 | 9.9 | 9.9 | 9.9 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 6.3 | 6.3 | 6.3 | 6.3 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.6 | 8.6 | 8.6 | 8.6 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 9.0 | 9.0 | 9.0 | 9.0 | 0 |

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
| correct | 210 | 36589.8 | 40802.9 | 41083.6 | 41215.8 |
| memory | 45 | 36611.7 | 41001.7 | 41235.5 | 41235.5 |
| loop | 45 | 46282.4 | 50604.6 | 50853.6 | 50853.6 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×210, runtime_error×45, timeout×45 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.98 / 0.98 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 36097.4 | 40491.0 | 40705.0 | 40902.6 |
| all | spawn | 300 | 282.5 | 314.6 | 484.4 | 518.5 |
| all | exec | 300 | 11.5 | 10009.3 | 10074.6 | 10076.8 |
| all | total | 300 | 36592.9 | 47701.2 | 50581.2 | 50730.2 |
| passed | queue | 210 | 36101.6 | 40493.8 | 40709.9 | 40902.6 |
| passed | spawn | 210 | 281.6 | 370.4 | 449.9 | 489.5 |
| passed | exec | 210 | 7.9 | 79.3 | 92.2 | 112.6 |
| passed | total | 210 | 36395.1 | 40787.5 | 40999.7 | 41192.3 |
| runtime_error | queue | 45 | 36097.4 | 40565.9 | 40705.0 | 40705.0 |
| runtime_error | spawn | 45 | 283.9 | 295.0 | 488.0 | 488.0 |
| runtime_error | exec | 45 | 195.2 | 208.4 | 299.0 | 299.0 |
| runtime_error | total | 45 | 36531.3 | 40988.8 | 41191.9 | 41191.9 |
| timeout | queue | 45 | 35976.0 | 40300.3 | 40506.7 | 40506.7 |
| timeout | spawn | 45 | 286.4 | 387.9 | 518.5 | 518.5 |
| timeout | exec | 45 | 10008.7 | 10075.0 | 10076.8 | 10076.8 |
| timeout | total | 45 | 46268.2 | 50589.8 | 50730.2 | 50730.2 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 390.1 | 432.9 |
| 25 | 10103.1 | 9692.2 |
| 50 | 20723.2 | 15194.8 |
| 75 | 26800.0 | 25878.7 |
| 100 | 38729.5 | 37181.0 |

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
| setup | heartbeat | 72 | 0 | 0.00 / 0.01 / 0.03 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 142 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | ranking | 98 | 0 | 0.00 / 0.00 / 0.00 | 1.05 / 1.48 / 103.27 | 3.99 / 5.85 / 91.10 | 3.61 / 72.46 / 74.70 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 18 ms) |

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

