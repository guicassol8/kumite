# Load report: burst `muvoxfr0`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:16:42.496Z |
| ended | 2026-10-05T20:20:08.106Z |
| node | v24.21.0 |
| commit | ed48fe6 |
| harness loadavg (1/5/15 min) at start | 0.90 / 1.57 / 1.34 |
| harness loadavg (1/5/15 min) at end | 1.96 / 1.73 / 1.45 |
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
| round | load-muvoxfr0 (1ebc81dd-ceb4-43f7-b425-095d1580e386) |
| problem | 4edde097-baf9-425e-8dce-e4fc47baa738 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.8 | 279.7 | 67.2 | 4.0 | 4.0 | 0.007 | 0 | 0 | 30 |
| setup | 72.1 | 133.0 | 146.5 | 488.8 | 101.1 | 89.3 | 89.3 | 0.088 | 0 | 0 | 66 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 103.3 | 192.2 | 205.4 | 369.9 | 107.8 | 66.5 | 68.2 | 0.048 | 98 | 0 | 102 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 98.6 | 98.6 | 340.4 | 74.9 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.3 | 5.4 | 16.5 | 16.5 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.1 | 5.2 | 9.7 | 9.7 | 0 |
| `POST /auth/login` | 1 | 200×1 | 91.1 | 91.1 | 91.1 | 91.1 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.6 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.0 | 4.0 | 4.0 | 4.0 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.3 | 15.3 | 15.3 | 15.3 | 0 |
| `GET /organizer/stats/live` | 66 | 200×66 | 85.2 | 299.9 | 309.6 | 309.6 | 0 |
| `GET /organizer/stats/process` | 66 | 200×66 | 85.8 | 299.5 | 307.8 | 307.8 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.7 | 11.7 | 11.7 | 11.7 | 0 |
| `POST /auth/login` | 300 | 200×300 | 487.8 | 584.7 | 597.0 | 682.4 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 494.7 | 587.0 | 600.6 | 607.6 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.8 | 4.4 | 4.4 | 4.4 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.3 | 6.8 | 6.8 | 6.8 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.4 | 9.4 | 9.4 | 9.4 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 7.8 | 7.8 | 7.8 | 7.8 | 0 |
| `POST /teams` | 100 | 201×100 | 7.7 | 9.5 | 12.2 | 12.4 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.4 | 14.7 | 19.3 | 21.9 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 102 | 200×102 | 2.9 | 4.7 | 48.2 | 94.7 | 0 |
| `GET /organizer/stats/process` | 102 | 200×102 | 2.8 | 4.5 | 47.6 | 93.4 | 0 |
| `POST /submissions` | 300 | 201×300 | 24232.8 | 31835.4 | 34260.6 | 38544.1 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /ranking` | 1 | 200×1 | 8.4 | 8.4 | 8.4 | 8.4 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.4 | 7.4 | 7.4 | 7.4 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 6.7 | 6.7 | 6.7 | 6.7 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 9.3 | 9.3 | 9.3 | 9.3 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 7.3 | 7.3 | 7.3 | 7.3 | 0 |

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
| correct | 270 | 24155.9 | 31296.9 | 31883.2 | 31903.8 |
| memory | 15 | 24276.5 | 31835.5 | 31835.5 | 31835.5 |
| loop | 15 | 33903.0 | 38544.1 | 38544.1 | 38544.1 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 98 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.94 / 0.96 / 0.97 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 2 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 23984.9 | 31095.7 | 31697.0 | 31781.9 |
| all | spawn | 300 | 127.7 | 206.5 | 275.6 | 298.6 |
| all | exec | 300 | 7.7 | 136.9 | 10009.2 | 10011.6 |
| all | total | 300 | 24217.9 | 31822.0 | 34247.5 | 37502.0 |
| passed | queue | 270 | 24001.7 | 31161.8 | 31697.4 | 31781.9 |
| passed | spawn | 270 | 126.8 | 204.8 | 288.2 | 298.6 |
| passed | exec | 270 | 7.6 | 49.0 | 83.1 | 113.1 |
| passed | total | 270 | 24141.6 | 31282.1 | 31867.7 | 31888.5 |
| runtime_error | queue | 15 | 24033.8 | 31591.5 | 31591.5 | 31591.5 |
| runtime_error | spawn | 15 | 121.5 | 180.1 | 180.1 | 180.1 |
| runtime_error | exec | 15 | 108.8 | 136.9 | 136.9 | 136.9 |
| runtime_error | total | 15 | 24260.3 | 31822.0 | 31822.0 | 31822.0 |
| timeout | queue | 15 | 23662.6 | 27307.1 | 27307.1 | 27307.1 |
| timeout | spawn | 15 | 157.9 | 274.0 | 274.0 | 274.0 |
| timeout | exec | 15 | 10008.8 | 10011.6 | 10011.6 | 10011.6 |
| timeout | total | 15 | 33849.8 | 37502.0 | 37502.0 | 37502.0 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 695.2 | 695.2 |
| 25 | 2901.8 | 2773.9 |
| 50 | 14174.6 | 13892.8 |
| 75 | 24693.9 | 24230.0 |
| 100 | 28439.5 | 27620.3 |

First k whose p95 queue wait passes 5000 ms: 27.

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
| setup | heartbeat | 72 | 0 | 0.00 / 0.01 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 103 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 53 | 0 | 0.00 / 0.00 / 0.00 | 0.96 / 1.49 / 32.98 | 3.82 / 5.33 / 190.77 | 3.50 / 4.84 / 7.69 |

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
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 14 ms) |

