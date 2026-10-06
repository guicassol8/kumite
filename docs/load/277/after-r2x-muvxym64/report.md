# Load report: burst `muvxym64`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-06T00:29:34.017Z |
| ended | 2026-10-06T00:32:08.674Z |
| node | v24.21.0 |
| commit | c443ec8 |
| harness loadavg (1/5/15 min) at start | 1.17 / 3.86 / 3.30 |
| harness loadavg (1/5/15 min) at end | 1.31 / 3.19 / 3.15 |
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
| round | load-muvxym64 (b9adfeb4-2f86-49b3-aaad-8e291efdce8c) |
| problem | 8a61e0e3-b02f-4caf-af61-20b995e22cbe |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.2 | 1.6 | 7.3 | 136.5 | 48.9 | 1.9 | 1.9 | 0.010 | 0 | 0 | 30 |
| setup | 80.6 | 129.2 | 158.6 | 356.1 | 64.7 | 85.7 | 85.7 | 0.085 | 0 | 0 | 74 |
| sse-ramp | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 43.8 | 197.8 | 202.8 | 412.0 | 112.2 | 79.0 | 79.0 | 0.107 | 96 | 0 | 43 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 93.2 | 93.2 | 381.2 | 87.6 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 4.7 | 13.1 | 20.8 | 20.8 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 4.3 | 11.7 | 12.1 | 12.1 | 0 |
| `POST /auth/login` | 1 | 200×1 | 160.5 | 160.5 | 160.5 | 160.5 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.4 | 4.4 | 4.4 | 4.4 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 7.8 | 7.8 | 7.8 | 7.8 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.1 | 5.1 | 5.1 | 5.1 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 17.8 | 17.8 | 17.8 | 17.8 | 0 |
| `GET /organizer/stats/live` | 74 | 200×74 | 85.0 | 298.6 | 312.4 | 312.4 | 0 |
| `GET /organizer/stats/process` | 74 | 200×74 | 86.8 | 297.0 | 312.0 | 312.0 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 32.5 | 38.2 | 38.2 | 38.2 | 0 |
| `POST /auth/login` | 300 | 200×300 | 490.2 | 599.6 | 686.9 | 780.3 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 512.0 | 757.2 | 1051.7 | 1055.0 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.6 | 22.0 | 22.0 | 22.0 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 23.1 | 77.0 | 77.0 | 77.0 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.2 | 9.2 | 9.2 | 9.2 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 34.3 | 34.3 | 34.3 | 34.3 | 0 |
| `POST /teams` | 100 | 201×100 | 48.5 | 79.8 | 86.4 | 161.8 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 31.1 | 84.4 | 168.6 | 170.1 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 43 | 200×43 | 3.2 | 98.2 | 204.3 | 204.3 | 0 |
| `GET /organizer/stats/process` | 43 | 200×43 | 3.1 | 97.9 | 203.9 | 203.9 | 0 |
| `POST /submissions` | 300 | 201×300 | 6126.6 | 14572.8 | 16240.0 | 21041.5 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.2 | 2.2 | 2.2 | 2.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /ranking` | 1 | 200×1 | 6.9 | 6.9 | 6.9 | 6.9 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.7 | 8.7 | 8.7 | 8.7 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 10.3 | 10.3 | 10.3 | 10.3 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.9 | 8.9 | 8.9 | 8.9 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 13.9 | 13.9 | 13.9 | 13.9 | 0 |

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
| correct | 270 | 6115.4 | 14036.9 | 14574.6 | 14595.2 |
| memory | 15 | 5949.1 | 14029.2 | 14029.2 | 14029.2 |
| loop | 15 | 15629.0 | 21041.6 | 21041.6 | 21041.6 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0 / 0.80 / 0.98 |
| workers spawned / exited / alive / idle at the end | 18 / 15 / 3 / 3 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 5709.3 | 13796.4 | 14304.1 | 14381.4 |
| all | spawn | 300 | 0 | 269.0 | 428.4 | 435.2 |
| all | exec | 300 | 4.0 | 291.4 | 10063.0 | 10070.4 |
| all | total | 300 | 5804.3 | 14308.4 | 16202.4 | 19496.6 |
| passed | queue | 270 | 5709.3 | 14004.2 | 14304.4 | 14381.4 |
| passed | spawn | 270 | 0 | 277.0 | 431.0 | 435.2 |
| passed | exec | 270 | 3.9 | 72.3 | 109.4 | 124.5 |
| passed | total | 270 | 5718.1 | 14015.0 | 14312.9 | 14390.2 |
| runtime_error | queue | 15 | 5713.2 | 13724.3 | 13724.3 | 13724.3 |
| runtime_error | spawn | 15 | 0 | 0 | 0 | 0 |
| runtime_error | exec | 15 | 191.5 | 291.4 | 291.4 | 291.4 |
| runtime_error | total | 15 | 5900.2 | 14005.2 | 14005.2 | 14005.2 |
| timeout | queue | 15 | 5499.7 | 9426.2 | 9426.2 | 9426.2 |
| timeout | spawn | 15 | 0 | 0 | 0 | 0 |
| timeout | exec | 15 | 10006.1 | 10070.4 | 10070.4 | 10070.4 |
| timeout | total | 15 | 15562.9 | 19496.6 | 19496.6 | 19496.6 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 203.9 | 537.3 |
| 25 | 22.8 | 529.7 |
| 50 | 328.1 | 528.4 |
| 75 | 9419.4 | 9419.4 |
| 100 | 10022.9 | 9912.3 |

First k whose p95 queue wait passes 5000 ms: 75.

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
| setup | heartbeat | 81 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 44 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 13 | 0 | 0.00 / 0.00 / 0.00 | 1.10 / 295.48 / 295.48 | 4.47 / 631.67 / 631.67 | 3.75 / 666.08 / 666.08 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 3, idle 3) |
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
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 15 ms) |

