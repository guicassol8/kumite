# Load report: burst `muvp2xmc`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:20:58.936Z |
| ended | 2026-10-05T20:23:41.615Z |
| node | v24.21.0 |
| commit | ed48fe6 |
| harness loadavg (1/5/15 min) at start | 1.01 / 1.49 / 1.38 |
| harness loadavg (1/5/15 min) at end | 3.26 / 1.82 / 1.48 |
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
| round | load-muvp2xmc (7cc4faa9-97b3-41d6-856f-43faa5f2fee1) |
| problem | e3b24e29-db8e-4139-9dc2-41242862bec7 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 2.0 | 280.5 | 67.2 | 1.2 | 1.2 | 0.008 | 0 | 0 | 30 |
| setup | 71.5 | 133.2 | 151.6 | 474.6 | 100.7 | 86.3 | 86.3 | 0.081 | 0 | 0 | 65 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 61.1 | 193.3 | 212.5 | 623.5 | 118.6 | 93.2 | 93.2 | 0.240 | 76 | 0 | 58 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 94.0 | 94.0 | 441.7 | 94.6 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 6.1 | 18.4 | 18.4 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.7 | 9.9 | 9.9 | 0 |
| `POST /auth/login` | 1 | 200×1 | 92.0 | 92.0 | 92.0 | 92.0 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.6 | 4.6 | 4.6 | 4.6 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.6 | 4.6 | 4.6 | 4.6 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.4 | 15.4 | 15.4 | 15.4 | 0 |
| `GET /organizer/stats/live` | 65 | 200×65 | 87.7 | 299.4 | 312.2 | 312.2 | 0 |
| `GET /organizer/stats/process` | 65 | 200×65 | 87.6 | 299.5 | 312.9 | 312.9 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.2 | 11.5 | 11.5 | 11.5 | 0 |
| `POST /auth/login` | 300 | 200×300 | 487.1 | 582.0 | 591.0 | 600.1 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 491.8 | 586.9 | 596.7 | 682.8 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.8 | 4.7 | 4.7 | 4.7 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.7 | 7.0 | 7.0 | 7.0 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.2 | 9.2 | 9.2 | 9.2 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.5 | 8.5 | 8.5 | 8.5 | 0 |
| `POST /teams` | 100 | 201×100 | 7.4 | 10.4 | 16.9 | 17.4 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.5 | 14.7 | 20.6 | 25.2 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 58 | 200×58 | 7.1 | 101.7 | 790.1 | 790.1 | 0 |
| `GET /organizer/stats/process` | 58 | 200×58 | 5.9 | 184.6 | 287.9 | 287.9 | 0 |
| `POST /submissions` | 300 | 201×300 | 12395.1 | 17207.4 | 22699.3 | 24419.5 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.2 | 2.2 | 2.2 | 2.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /ranking` | 1 | 200×1 | 7.9 | 7.9 | 7.9 | 7.9 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.0 | 7.0 | 7.0 | 7.0 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.9 | 7.9 | 7.9 | 7.9 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 10.1 | 10.1 | 10.1 | 10.1 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

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
| correct | 270 | 12314.7 | 14925.4 | 17131.6 | 17208.2 |
| memory | 15 | 12696.2 | 17414.3 | 17414.3 | 17414.3 |
| loop | 15 | 22219.8 | 24419.7 | 24419.7 | 24419.7 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 79 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.88 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 8 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 11197.7 | 11902.7 | 13611.2 | 13900.9 |
| all | spawn | 300 | 797.0 | 899.8 | 987.0 | 994.0 |
| all | exec | 300 | 105.4 | 798.4 | 10192.4 | 10307.5 |
| all | total | 300 | 12109.0 | 14702.3 | 22210.0 | 22698.3 |
| passed | queue | 270 | 11199.3 | 11987.5 | 13611.2 | 13900.9 |
| passed | spawn | 270 | 797.5 | 899.8 | 987.7 | 994.0 |
| passed | exec | 270 | 103.6 | 305.1 | 400.1 | 606.7 |
| passed | total | 270 | 12101.5 | 12984.7 | 14695.1 | 14703.3 |
| runtime_error | queue | 15 | 11102.0 | 13705.1 | 13705.1 | 13705.1 |
| runtime_error | spawn | 15 | 797.0 | 901.3 | 901.3 | 901.3 |
| runtime_error | exec | 15 | 589.6 | 798.4 | 798.4 | 798.4 |
| runtime_error | total | 15 | 12389.8 | 14916.8 | 14916.8 | 14916.8 |
| timeout | queue | 15 | 11103.5 | 11794.5 | 11794.5 | 11794.5 |
| timeout | spawn | 15 | 790.2 | 903.2 | 903.2 | 903.2 |
| timeout | exec | 15 | 10105.6 | 10307.5 | 10307.5 | 10307.5 |
| timeout | total | 15 | 22002.2 | 22698.3 | 22698.3 | 22698.3 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 0.0 | 0.0 |
| 25 | 1812.5 | 1887.7 |
| 50 | 5298.3 | 5294.4 |
| 75 | 9503.5 | 9494.5 |
| 100 | 13900.9 | 13109.3 |

First k whose p95 queue wait passes 5000 ms: 49.

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
| setup | heartbeat | 71 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 61 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 55 | 0 | 0.00 / 0.00 / 0.00 | 1.43 / 88.80 / 295.11 | 7.60 / 102.72 / 515.11 | 8.74 / 96.48 / 194.24 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 16 ms) |

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
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 12 ms) |

