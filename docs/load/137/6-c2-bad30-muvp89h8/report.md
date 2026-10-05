# Load report: burst `muvp89h8`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:25:07.584Z |
| ended | 2026-10-05T20:31:05.508Z |
| node | v24.21.0 |
| commit | ed48fe6 |
| harness loadavg (1/5/15 min) at start | 1.01 / 1.42 / 1.37 |
| harness loadavg (1/5/15 min) at end | 2.05 / 1.83 / 1.56 |
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
| round | load-muvp89h8 (007e0bbe-aae8-487f-ab0a-db08c33cbd43) |
| problem | ef45d885-c76e-4c60-8ba8-f5d5450fbe32 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 1.9 | 280.2 | 67.2 | 6.0 | 6.0 | 0.008 | 0 | 0 | 30 |
| setup | 72.9 | 134.3 | 153.1 | 481.7 | 100.6 | 87.7 | 87.7 | 0.084 | 0 | 0 | 67 |
| sse-ramp | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 254.9 | 196.4 | 206.9 | 448.5 | 115.2 | 59.4 | 69.5 | 0.020 | 98 | 0 | 253 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 97.5 | 97.5 | 331.1 | 94.3 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 6.0 | 16.4 | 16.4 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.8 | 9.2 | 9.2 | 0 |
| `POST /auth/login` | 1 | 200×1 | 95.0 | 95.0 | 95.0 | 95.0 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 5.7 | 5.7 | 5.7 | 5.7 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 20.5 | 20.5 | 20.5 | 20.5 | 0 |
| `GET /organizer/stats/live` | 67 | 200×67 | 88.8 | 288.0 | 310.3 | 310.3 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 88.4 | 287.8 | 311.2 | 311.2 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.5 | 12.6 | 12.6 | 12.6 | 0 |
| `POST /auth/login` | 300 | 200×300 | 490.0 | 585.8 | 597.5 | 610.0 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 494.9 | 593.2 | 606.4 | 698.9 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.4 | 4.5 | 4.5 | 4.5 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 7.1 | 9.1 | 9.1 | 9.1 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 16.8 | 16.8 | 16.8 | 16.8 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 13.9 | 13.9 | 13.9 | 13.9 | 0 |
| `POST /teams` | 100 | 201×100 | 8.2 | 15.4 | 17.7 | 17.9 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.7 | 22.2 | 48.0 | 55.4 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 253 | 200×253 | 2.8 | 4.0 | 31.0 | 88.2 | 0 |
| `GET /organizer/stats/process` | 253 | 200×253 | 2.7 | 4.1 | 30.8 | 88.9 | 0 |
| `POST /submissions` | 300 | 201×300 | 73677.7 | 83592.0 | 84900.6 | 93417.7 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.1 | 2.1 | 2.1 | 2.1 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |
| `GET /ranking` | 1 | 200×1 | 6.6 | 6.6 | 6.6 | 6.6 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.4 | 8.4 | 8.4 | 8.4 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.6 | 7.6 | 7.6 | 7.6 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 7.1 | 7.1 | 7.1 | 7.1 | 0 |

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
| correct | 210 | 73565.0 | 83007.9 | 83609.4 | 83835.6 |
| memory | 45 | 73699.6 | 82944.0 | 83709.4 | 83709.4 |
| loop | 45 | 83112.9 | 85290.8 | 93417.9 | 93417.9 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×210, runtime_error×45, timeout×45 |
| largest queue at an arrival (itself included) | 98 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.94 / 0.96 / 0.97 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 2 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 73345.7 | 82799.8 | 83465.6 | 83701.6 |
| all | spawn | 300 | 127.2 | 204.2 | 283.3 | 300.6 |
| all | exec | 300 | 8.4 | 10009.1 | 10041.0 | 10058.1 |
| all | total | 300 | 73664.8 | 83576.5 | 84884.9 | 93404.3 |
| passed | queue | 210 | 73396.3 | 82879.2 | 83465.6 | 83701.6 |
| passed | spawn | 210 | 125.1 | 206.1 | 282.1 | 300.6 |
| passed | exec | 210 | 7.6 | 63.3 | 82.0 | 90.3 |
| passed | total | 210 | 73535.2 | 82993.7 | 83595.3 | 83821.6 |
| runtime_error | queue | 45 | 73457.6 | 82699.1 | 83467.6 | 83467.6 |
| runtime_error | spawn | 45 | 126.1 | 165.8 | 202.7 | 202.7 |
| runtime_error | exec | 45 | 106.7 | 126.9 | 192.4 | 192.4 |
| runtime_error | total | 45 | 73687.9 | 82929.6 | 83695.6 | 83695.6 |
| timeout | queue | 45 | 72971.2 | 75107.5 | 83279.9 | 83279.9 |
| timeout | spawn | 45 | 149.3 | 221.6 | 288.8 | 288.8 |
| timeout | exec | 45 | 10008.8 | 10042.4 | 10058.1 | 10058.1 |
| timeout | total | 45 | 83098.5 | 85277.5 | 93404.3 | 93404.3 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1121.6 | 1121.6 |
| 25 | 21724.3 | 21683.6 |
| 50 | 43901.1 | 33980.1 |
| 75 | 56743.3 | 56107.6 |
| 100 | 79206.8 | 78309.2 |

First k whose p95 queue wait passes 5000 ms: 15.

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
| load | heartbeat | 254 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 71 | 0 | 0.00 / 0.00 / 0.00 | 0.96 / 1.50 / 2.00 | 3.63 / 5.77 / 7.94 | 3.57 / 6.28 / 66.81 |

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

