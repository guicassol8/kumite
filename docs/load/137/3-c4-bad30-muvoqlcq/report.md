# Load report: burst `muvoqlcq`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:11:23.166Z |
| ended | 2026-10-05T20:15:26.633Z |
| node | v24.21.0 |
| commit | ed48fe6 |
| harness loadavg (1/5/15 min) at start | 0.88 / 1.36 / 1.16 |
| harness loadavg (1/5/15 min) at end | 2.63 / 1.96 / 1.44 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3137 |
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
| round | load-muvoqlcq (5d8f11e9-a21e-452f-9fd3-62340980b345) |
| problem | 4249d435-e44d-4280-9655-c20e80fa4494 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.8 | 280.4 | 67.2 | 4.1 | 4.1 | 0.007 | 0 | 0 | 30 |
| setup | 72.2 | 133.4 | 148.7 | 474.3 | 100.8 | 87.8 | 87.8 | 0.081 | 0 | 0 | 67 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 141.1 | 196.6 | 205.1 | 497.2 | 114.5 | 71.3 | 79.7 | 0.044 | 96 | 0 | 139 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 97.8 | 97.8 | 380.1 | 93.2 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.3 | 5.5 | 17.6 | 17.6 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.1 | 5.1 | 9.8 | 9.8 | 0 |
| `POST /auth/login` | 1 | 200×1 | 99.5 | 99.5 | 99.5 | 99.5 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.7 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.2 | 5.2 | 5.2 | 5.2 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.5 | 15.5 | 15.5 | 15.5 | 0 |
| `GET /organizer/stats/live` | 67 | 200×67 | 88.6 | 205.2 | 288.8 | 288.8 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 87.1 | 207.9 | 289.9 | 289.9 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.5 | 11.0 | 11.0 | 11.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 489.6 | 589.2 | 600.2 | 702.7 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 491.0 | 590.5 | 604.3 | 910.1 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.5 | 4.9 | 4.9 | 4.9 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.2 | 6.9 | 6.9 | 6.9 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 8.7 | 8.7 | 8.7 | 8.7 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 7.7 | 7.7 | 7.7 | 7.7 | 0 |
| `POST /teams` | 100 | 201×100 | 7.5 | 12.9 | 15.3 | 15.7 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.4 | 13.8 | 47.2 | 48.2 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 139 | 200×139 | 2.9 | 59.8 | 76.8 | 593.2 | 0 |
| `GET /organizer/stats/process` | 139 | 200×139 | 2.8 | 59.4 | 75.7 | 203.0 | 0 |
| `POST /submissions` | 300 | 201×300 | 37985.4 | 48399.9 | 51110.8 | 52205.0 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /ranking` | 1 | 200×1 | 6.0 | 6.0 | 6.0 | 6.0 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.8 | 7.8 | 7.8 | 7.8 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 10.3 | 10.3 | 10.3 | 10.3 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 11.0 | 11.0 | 11.0 | 11.0 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 7.0 | 7.0 | 7.0 | 7.0 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

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
| correct | 210 | 37388.3 | 41717.9 | 42414.1 | 42519.5 |
| memory | 45 | 37698.5 | 41210.5 | 42523.0 | 42523.0 |
| loop | 45 | 45993.9 | 51201.3 | 52205.2 | 52205.2 |

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
| all | queue | 300 | 36882.3 | 41293.3 | 42105.7 | 42283.4 |
| all | spawn | 300 | 281.1 | 375.7 | 430.3 | 520.3 |
| all | exec | 300 | 8.8 | 10009.1 | 10079.1 | 10103.7 |
| all | total | 300 | 37485.4 | 48302.7 | 51098.0 | 52193.2 |
| passed | queue | 210 | 36882.4 | 41484.5 | 42107.1 | 42283.4 |
| passed | spawn | 210 | 279.6 | 368.5 | 430.3 | 520.3 |
| passed | exec | 210 | 7.7 | 83.7 | 188.8 | 196.5 |
| passed | total | 210 | 37177.4 | 41700.7 | 42396.8 | 42503.7 |
| runtime_error | queue | 45 | 36905.1 | 40785.1 | 42096.8 | 42096.8 |
| runtime_error | spawn | 45 | 283.7 | 387.7 | 485.8 | 485.8 |
| runtime_error | exec | 45 | 191.5 | 292.7 | 381.2 | 381.2 |
| runtime_error | total | 45 | 37378.7 | 41195.6 | 42507.5 | 42507.5 |
| timeout | queue | 45 | 35686.7 | 40888.1 | 41882.2 | 41882.2 |
| timeout | spawn | 45 | 286.3 | 384.6 | 396.0 | 396.0 |
| timeout | exec | 45 | 10008.8 | 10088.5 | 10103.7 | 10103.7 |
| timeout | total | 45 | 45980.9 | 51189.4 | 52193.2 | 52193.2 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 502.6 | 603.8 |
| 25 | 10403.0 | 10182.4 |
| 50 | 21481.7 | 14984.5 |
| 75 | 27579.0 | 26596.5 |
| 100 | 38698.7 | 37495.1 |

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
| setup | heartbeat | 72 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 141 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 94 | 0 | 0.00 / 0.00 / 0.02 | 0.98 / 1.33 / 2.04 | 3.77 / 5.65 / 77.28 | 3.68 / 5.34 / 77.92 |

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
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 17 ms) |

