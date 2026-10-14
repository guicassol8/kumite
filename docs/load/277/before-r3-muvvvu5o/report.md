# Load report: burst `muvvvu5o`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-05T23:31:25.168Z |
| ended | 2026-10-05T23:35:31.249Z |
| node | v24.21.0 |
| commit | a9beaf8 |
| harness loadavg (1/5/15 min) at start | 0.93 / 1.39 / 1.45 |
| harness loadavg (1/5/15 min) at end | 1.52 / 1.59 / 1.51 |
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
| round | load-muvvvu5o (766d33b5-8c12-4f2a-8594-85206c4686cb) |
| problem | 2cb66c88-55d2-4aa4-a6b8-1e52fd10dc4e |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.1 | 1.6 | 281.1 | 81.1 | 2.1 | 2.1 | 0.008 | 0 | 0 | 30 |
| setup | 73.6 | 135.4 | 150.4 | 479.3 | 99.5 | 202.3 | 202.3 | 0.074 | 0 | 0 | 68 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 142.3 | 196.7 | 206.1 | 490.0 | 125.3 | 74.7 | 81.6 | 0.052 | 96 | 0 | 140 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 97.5 | 97.5 | 378.3 | 96.5 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 4.0 | 6.5 | 18.7 | 18.7 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.6 | 6.2 | 9.3 | 9.3 | 0 |
| `POST /auth/login` | 1 | 200×1 | 85.5 | 85.5 | 85.5 | 85.5 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.4 | 4.4 | 4.4 | 4.4 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 6.7 | 6.7 | 6.7 | 6.7 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.1 | 5.1 | 5.1 | 5.1 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 20.3 | 20.3 | 20.3 | 20.3 | 0 |
| `GET /organizer/stats/live` | 68 | 200×68 | 82.9 | 218.0 | 382.4 | 382.4 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 83.8 | 217.2 | 381.9 | 381.9 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.8 | 12.6 | 12.6 | 12.6 | 0 |
| `POST /auth/login` | 300 | 200×300 | 493.0 | 583.3 | 591.8 | 674.8 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 497.6 | 596.3 | 609.7 | 685.4 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.0 | 4.6 | 4.6 | 4.6 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 7.4 | 7.5 | 7.5 | 7.5 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 8.7 | 8.7 | 8.7 | 8.7 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 7.7 | 7.7 | 7.7 | 7.7 | 0 |
| `POST /teams` | 100 | 201×100 | 8.0 | 10.8 | 48.0 | 48.5 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 11.0 | 14.9 | 23.3 | 24.1 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 140 | 200×140 | 3.2 | 67.9 | 83.7 | 787.2 | 0 |
| `GET /organizer/stats/process` | 140 | 200×140 | 3.2 | 67.6 | 82.9 | 283.3 | 0 |
| `POST /submissions` | 300 | 201×300 | 38514.4 | 49395.9 | 50594.9 | 51983.5 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.2 | 2.2 | 2.2 | 2.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /ranking` | 1 | 200×1 | 8.7 | 8.7 | 8.7 | 8.7 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.8 | 7.8 | 7.8 | 7.8 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 6.4 | 6.4 | 6.4 | 6.4 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.5 | 8.5 | 8.5 | 8.5 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 9.8 | 9.8 | 9.8 | 9.8 | 0 |

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
| correct | 210 | 38200.1 | 41488.9 | 41810.3 | 42106.8 |
| memory | 45 | 38262.6 | 41704.6 | 42196.1 | 42196.1 |
| loop | 45 | 47979.9 | 50886.2 | 51983.7 | 51983.7 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×210, runtime_error×45, timeout×45 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.98 / 0.99 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 37567.9 | 41015.1 | 41497.6 | 41707.0 |
| all | spawn | 300 | 286.4 | 390.4 | 489.6 | 507.0 |
| all | exec | 300 | 11.4 | 10010.6 | 10079.0 | 10080.6 |
| all | total | 300 | 38402.6 | 48386.1 | 50580.5 | 51408.0 |
| passed | queue | 210 | 37613.7 | 41171.3 | 41413.7 | 41707.0 |
| passed | spawn | 210 | 286.3 | 394.7 | 489.6 | 507.0 |
| passed | exec | 210 | 8.2 | 79.7 | 106.1 | 188.7 |
| passed | total | 210 | 38001.3 | 41474.4 | 41795.6 | 42088.2 |
| runtime_error | queue | 45 | 37701.8 | 41256.8 | 41584.7 | 41584.7 |
| runtime_error | spawn | 45 | 282.7 | 377.4 | 483.5 | 483.5 |
| runtime_error | exec | 45 | 199.4 | 232.3 | 277.1 | 277.1 |
| runtime_error | total | 45 | 38212.6 | 41691.3 | 42180.2 | 42180.2 |
| timeout | queue | 45 | 37466.8 | 40512.7 | 41176.1 | 41176.1 |
| timeout | spawn | 45 | 289.2 | 384.6 | 498.6 | 498.6 |
| timeout | exec | 45 | 10009.4 | 10079.3 | 10080.6 | 10080.6 |
| timeout | total | 45 | 47774.9 | 50807.5 | 51408.0 | 51408.0 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 418.9 | 589.1 |
| 25 | 9596.7 | 3513.5 |
| 50 | 15907.2 | 15394.0 |
| 75 | 27600.5 | 26587.2 |
| 100 | 37497.0 | 36116.3 |

First k whose p95 queue wait passes 5000 ms: 26.

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
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.02 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 73 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 142 | 0 | 0.00 / 0.00 / 0.02 | — / — / — | — / — / — | — / — / — |
| load | ranking | 108 | 0 | 0.00 / 0.00 / 0.00 | 1.04 / 66.59 / 96.43 | 3.99 / 70.21 / 299.71 | 3.82 / 68.86 / 71.15 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 17 ms) |

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

