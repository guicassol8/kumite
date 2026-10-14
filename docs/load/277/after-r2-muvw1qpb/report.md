# Load report: burst `muvw1qpb`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-05T23:36:00.628Z |
| ended | 2026-10-05T23:39:06.092Z |
| node | v24.21.0 |
| commit | c443ec8 |
| harness loadavg (1/5/15 min) at start | 0.98 / 1.45 / 1.46 |
| harness loadavg (1/5/15 min) at end | 2.00 / 1.84 / 1.63 |
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
| round | load-muvw1qpb (babc0f80-60d1-410b-b778-60a5cafbbf70) |
| problem | 5aca9ecd-b1e0-49fd-a74d-5092319f3d44 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 1.8 | 280.2 | 72.1 | 1.1 | 1.1 | 0.007 | 0 | 0 | 30 |
| setup | 87.1 | 110.0 | 151.0 | 477.8 | 101.2 | 94.6 | 94.6 | 0.060 | 0 | 0 | 81 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 68.2 | 168.9 | 204.8 | 458.4 | 136.8 | 95.8 | 95.8 | 0.064 | 96 | 0 | 37 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 114.3 | 114.3 | 417.0 | 55.6 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.6 | 6.7 | 15.7 | 15.7 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.4 | 6.3 | 9.2 | 9.2 | 0 |
| `POST /auth/login` | 1 | 200×1 | 106.0 | 106.0 | 106.0 | 106.0 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 5.1 | 5.1 | 5.1 | 5.1 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.2 | 5.2 | 5.2 | 5.2 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 18.6 | 18.6 | 18.6 | 18.6 | 0 |
| `GET /organizer/stats/live` | 81 | 200×81 | 79.1 | 285.5 | 382.3 | 382.3 | 0 |
| `GET /organizer/stats/process` | 81 | 200×81 | 79.0 | 286.7 | 382.1 | 382.1 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.9 | 11.7 | 11.7 | 11.7 | 0 |
| `POST /auth/login` | 300 | 200×300 | 466.0 | 575.2 | 593.2 | 604.7 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 503.4 | 2011.9 | 4531.5 | 5030.7 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.9 | 4.8 | 4.8 | 4.8 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.5 | 9.7 | 9.7 | 9.7 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 12.1 | 12.1 | 12.1 | 12.1 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 9.0 | 9.0 | 9.0 | 9.0 | 0 |
| `POST /teams` | 100 | 201×100 | 8.6 | 12.8 | 16.1 | 39.6 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 11.4 | 16.7 | 44.0 | 47.7 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 37 | 200×37 | 2.9 | 629.1 | 30386.8 | 30386.8 | 0 |
| `GET /organizer/stats/process` | 37 | 200×37 | 2.8 | 375.7 | 30387.9 | 30387.9 | 0 |
| `POST /submissions` | 300 | 201×300 | 6211.0 | 44935.8 | 45576.5 | 52404.0 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /ranking` | 1 | 200×1 | 8.4 | 8.4 | 8.4 | 8.4 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 10.5 | 10.5 | 10.5 | 10.5 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 6.5 | 6.5 | 6.5 | 6.5 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 10.6 | 10.6 | 10.6 | 10.6 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 12.2 | 12.2 | 12.2 | 12.2 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 270 | 0 | 0 |
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
| submission | 300 | 300 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 270 | 6187.3 | 44927.8 | 45481.1 | 45488.1 |
| memory | 15 | 6315.4 | 44947.9 | 44947.9 | 44947.9 |
| loop | 15 | 34891.9 | 52404.1 | 52404.1 | 52404.1 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0 / 0.82 / 0.98 |
| workers spawned / exited / alive / idle at the end | 19 / 15 / 4 / 4 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 5799.6 | 13910.3 | 14199.7 | 14201.0 |
| all | spawn | 300 | 0 | 283.0 | 438.0 | 450.7 |
| all | exec | 300 | 4.1 | 211.1 | 10009.9 | 10066.0 |
| all | total | 300 | 5911.8 | 14119.8 | 16070.4 | 19791.1 |
| passed | queue | 270 | 5801.5 | 13914.3 | 14200.6 | 14201.0 |
| passed | spawn | 270 | 0 | 289.0 | 444.9 | 450.7 |
| passed | exec | 270 | 3.8 | 70.3 | 103.0 | 123.1 |
| passed | total | 270 | 5812.0 | 13988.4 | 14203.6 | 14204.5 |
| runtime_error | queue | 15 | 5609.1 | 13713.3 | 13713.3 | 13713.3 |
| runtime_error | spawn | 15 | 0 | 0 | 0 | 0 |
| runtime_error | exec | 15 | 191.5 | 211.1 | 211.1 | 211.1 |
| runtime_error | total | 15 | 5800.6 | 13896.6 | 13896.6 | 13896.6 |
| timeout | queue | 15 | 5583.5 | 9728.9 | 9728.9 | 9728.9 |
| timeout | spawn | 15 | 0 | 0 | 0 | 0 |
| timeout | exec | 15 | 10005.5 | 10066.0 | 10066.0 | 10066.0 |
| timeout | total | 15 | 15593.4 | 19791.1 | 19791.1 | 19791.1 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 0.0 | 539.1 |
| 25 | 116.8 | 536.8 |
| 50 | 493.6 | 493.6 |
| 75 | 9601.4 | 9599.6 |
| 100 | 10188.8 | 10008.3 |

First k whose p95 queue wait passes 5000 ms: 74.

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
| setup | heartbeat | 87 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 68 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 11 | 0 | 0.00 / 0.00 / 0.00 | 1.06 / 64.09 / 64.09 | 4.49 / 561.12 / 561.12 | 3.96 / 69.83 / 69.83 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 4, idle 4) |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 19 ms) |

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

