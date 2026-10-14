# Load report: burst `muvvfyzg`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-05T23:19:04.928Z |
| ended | 2026-10-05T23:21:26.522Z |
| node | v24.21.0 |
| commit | a9beaf8 |
| harness loadavg (1/5/15 min) at start | 0.28 / 1.37 / 1.57 |
| harness loadavg (1/5/15 min) at end | 3.11 / 1.65 / 1.62 |
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
| badFraction | 0 |
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
| round | load-muvvfyzg (9478cfe7-7439-4421-ade8-d735878b2d6a) |
| problem | 6e129f62-b9b3-4959-a2fe-1689263c121d |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.6 | 280.2 | 66.8 | 1.0 | 1.0 | 0.007 | 0 | 0 | 30 |
| setup | 73.1 | 132.8 | 149.5 | 490.9 | 99.4 | 87.8 | 87.8 | 0.078 | 0 | 0 | 68 |
| sse-ramp | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 38.3 | 198.2 | 205.8 | 475.7 | 132.9 | 82.8 | 82.8 | 0.229 | 82 | 0 | 37 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 163.6 | 163.6 | 454.8 | 96.8 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.6 | 5.4 | 15.2 | 15.2 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.4 | 5.1 | 8.2 | 8.2 | 0 |
| `POST /auth/login` | 1 | 200×1 | 82.6 | 82.6 | 82.6 | 82.6 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 6.1 | 6.1 | 6.1 | 6.1 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 20.1 | 20.1 | 20.1 | 20.1 | 0 |
| `GET /organizer/stats/live` | 68 | 200×68 | 78.3 | 291.3 | 376.4 | 376.4 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 79.3 | 292.3 | 377.6 | 377.6 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.8 | 13.4 | 13.4 | 13.4 | 0 |
| `POST /auth/login` | 300 | 200×300 | 492.3 | 583.3 | 601.3 | 610.5 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 495.6 | 592.3 | 599.6 | 603.6 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.0 | 6.2 | 6.2 | 6.2 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 7.1 | 10.1 | 10.1 | 10.1 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 10.4 | 10.4 | 10.4 | 10.4 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.5 | 8.5 | 8.5 | 8.5 | 0 |
| `POST /teams` | 100 | 201×100 | 8.5 | 13.3 | 15.7 | 42.1 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 11.1 | 19.1 | 34.8 | 45.6 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 37 | 200×37 | 4.1 | 80.8 | 697.5 | 697.5 | 0 |
| `GET /organizer/stats/process` | 37 | 200×37 | 4.1 | 80.4 | 120.0 | 120.0 | 0 |
| `POST /submissions` | 300 | 201×300 | 7606.1 | 11787.8 | 13297.4 | 13801.3 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /ranking` | 1 | 200×1 | 6.0 | 6.0 | 6.0 | 6.0 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.2 | 8.2 | 8.2 | 8.2 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 8.1 | 8.1 | 8.1 | 8.1 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.1 | 7.1 | 7.1 | 7.1 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 5.7 | 5.7 | 5.7 | 5.7 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 7.0 | 7.0 | 7.0 | 7.0 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted |
| --- | --- |
| correct | 300 |

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
| correct | 300 | 7606.2 | 11787.9 | 13297.4 | 13801.4 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×300 |
| largest queue at an arrival (itself included) | 85 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.79 / 0.95 / 0.98 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 6987.5 | 9217.7 | 10628.8 | 11123.2 |
| all | spawn | 300 | 397.5 | 492.3 | 507.1 | 602.8 |
| all | exec | 300 | 102.5 | 187.7 | 197.2 | 200.1 |
| all | total | 300 | 7488.4 | 9706.1 | 11129.8 | 11618.4 |
| passed | queue | 300 | 6987.5 | 9217.7 | 10628.8 | 11123.2 |
| passed | spawn | 300 | 397.5 | 492.3 | 507.1 | 602.8 |
| passed | exec | 300 | 102.5 | 187.7 | 197.2 | 200.1 |
| passed | total | 300 | 7488.4 | 9706.1 | 11129.8 | 11618.4 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 289.2 | 555.9 |
| 25 | 2101.9 | 2095.9 |
| 50 | 4992.4 | 4992.4 |
| 75 | 7786.6 | 7786.6 |
| 100 | 11123.2 | 10200.4 |

First k whose p95 queue wait passes 5000 ms: 54.

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
| setup | heartbeat | 73 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 38 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 37 | 0 | 0.00 / 0.00 / 0.00 | 1.26 / 75.19 / 185.44 | 5.77 / 91.18 / 209.27 | 5.20 / 90.24 / 98.58 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 15 ms) |

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

