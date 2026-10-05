# Load report: burst `muvph4u5`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:32:01.473Z |
| ended | 2026-10-05T20:35:18.395Z |
| node | v24.21.0 |
| commit | ed48fe6 |
| harness loadavg (1/5/15 min) at start | 1.19 / 1.60 / 1.49 |
| harness loadavg (1/5/15 min) at end | 0.90 / 1.40 / 1.43 |
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
| round | load-muvph4u5 (a47ea3aa-4fc3-475a-80d4-83dae797b4c3) |
| problem | 2459155e-22ca-4ad9-8406-1130e5e90c26 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.9 | 280.6 | 67.2 | 7.9 | 7.9 | 0.007 | 0 | 0 | 30 |
| setup | 72.4 | 132.9 | 150.3 | 474.9 | 99.8 | 90.8 | 90.8 | 0.082 | 0 | 0 | 66 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 94.4 | 197.7 | 210.6 | 683.6 | 122.9 | 90.6 | 90.6 | 0.138 | 79 | 0 | 90 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 99.1 | 99.1 | 458.1 | 84.4 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 5.5 | 17.4 | 17.4 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.1 | 9.7 | 9.7 | 0 |
| `POST /auth/login` | 1 | 200×1 | 94.2 | 94.2 | 94.2 | 94.2 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.7 | 4.7 | 4.7 | 4.7 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.8 | 5.8 | 5.8 | 5.8 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 14.4 | 14.4 | 14.4 | 14.4 | 0 |
| `GET /organizer/stats/live` | 66 | 200×66 | 88.0 | 298.5 | 379.9 | 379.9 | 0 |
| `GET /organizer/stats/process` | 66 | 200×66 | 87.2 | 299.8 | 380.4 | 380.4 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 12.7 | 19.0 | 19.0 | 19.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 484.9 | 578.8 | 597.0 | 612.5 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 495.3 | 592.6 | 599.9 | 612.8 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 5.1 | 11.6 | 11.6 | 11.6 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 7.9 | 9.9 | 9.9 | 9.9 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 10.4 | 10.4 | 10.4 | 10.4 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 9.9 | 9.9 | 9.9 | 9.9 | 0 |
| `POST /teams` | 100 | 201×100 | 9.6 | 16.2 | 40.8 | 40.8 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 12.3 | 21.8 | 24.1 | 42.1 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 90 | 200×90 | 5.2 | 93.9 | 888.9 | 888.9 | 0 |
| `GET /organizer/stats/process` | 90 | 200×90 | 4.6 | 91.5 | 394.5 | 394.5 | 0 |
| `POST /submissions` | 300 | 201×300 | 22390.3 | 32688.3 | 33194.8 | 36689.6 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.2 | 2.2 | 2.2 | 2.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |
| `GET /ranking` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.0 | 8.0 | 8.0 | 8.0 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 6.1 | 6.1 | 6.1 | 6.1 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.3 | 8.3 | 8.3 | 8.3 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 6.9 | 6.9 | 6.9 | 6.9 | 0 |

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
| correct | 210 | 22192.6 | 23392.8 | 25995.0 | 26891.6 |
| memory | 45 | 22804.0 | 24279.5 | 26184.3 | 26184.3 |
| loop | 45 | 32493.9 | 33489.4 | 36689.7 | 36689.7 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×210, runtime_error×45, timeout×45 |
| largest queue at an arrival (itself included) | 83 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.89 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 8 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 21317.7 | 22383.3 | 22790.0 | 23303.3 |
| all | spawn | 300 | 700.7 | 826.1 | 991.3 | 1009.5 |
| all | exec | 300 | 94.9 | 10094.8 | 10181.2 | 10394.6 |
| all | total | 300 | 22200.8 | 32594.7 | 33088.3 | 33895.9 |
| passed | queue | 210 | 21294.9 | 22394.1 | 22790.0 | 23303.3 |
| passed | spawn | 210 | 701.2 | 802.7 | 988.3 | 1009.5 |
| passed | exec | 210 | 89.3 | 115.3 | 303.2 | 504.7 |
| passed | total | 210 | 22000.8 | 23192.4 | 23396.9 | 24094.7 |
| runtime_error | queue | 45 | 21504.1 | 22201.6 | 22492.9 | 22492.9 |
| runtime_error | spawn | 45 | 695.4 | 869.7 | 1001.9 | 1001.9 |
| runtime_error | exec | 45 | 493.3 | 697.7 | 892.5 | 892.5 |
| runtime_error | total | 45 | 22600.2 | 23291.9 | 23691.6 | 23691.6 |
| timeout | queue | 45 | 21595.6 | 22387.8 | 23197.5 | 23197.5 |
| timeout | spawn | 45 | 703.5 | 893.6 | 902.5 | 902.5 |
| timeout | exec | 45 | 10091.6 | 10204.8 | 10394.6 | 10394.6 |
| timeout | total | 45 | 32311.1 | 33090.9 | 33895.9 | 33895.9 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 0.0 | 0.0 |
| 25 | 2691.7 | 2691.7 |
| 50 | 10305.6 | 9599.4 |
| 75 | 16189.1 | 15398.7 |
| 100 | 23303.3 | 21914.1 |

First k whose p95 queue wait passes 5000 ms: 36.

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
| load | heartbeat | 94 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 89 | 0 | 0.00 / 0.00 / 0.02 | 1.15 / 83.60 / 209.13 | 5.17 / 94.24 / 994.90 | 4.69 / 89.86 / 96.28 |

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

