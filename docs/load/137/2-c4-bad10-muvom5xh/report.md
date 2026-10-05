# Load report: burst `muvom5xh`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:07:56.553Z |
| ended | 2026-10-05T20:10:47.300Z |
| node | v24.21.0 |
| commit | ed48fe6 |
| harness loadavg (1/5/15 min) at start | 0.85 / 1.34 / 1.08 |
| harness loadavg (1/5/15 min) at end | 1.59 / 1.53 / 1.21 |
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
| round | load-muvom5xh (abf78198-4106-4a95-b9d3-700a94663973) |
| problem | 52eae4e3-39b3-427b-a522-49e0f1f1a747 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 2.1 | 280.2 | 67.2 | 4.2 | 4.2 | 0.007 | 0 | 0 | 30 |
| setup | 72.4 | 131.8 | 148.8 | 474.6 | 99.6 | 87.9 | 87.9 | 0.072 | 0 | 0 | 66 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 68.2 | 192.9 | 205.2 | 431.8 | 121.2 | 80.2 | 80.2 | 0.102 | 84 | 0 | 67 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 113.5 | 113.5 | 391.2 | 51.9 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 5.8 | 18.0 | 18.0 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 5.4 | 9.4 | 9.4 | 0 |
| `POST /auth/login` | 1 | 200×1 | 91.1 | 91.1 | 91.1 | 91.1 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.7 | 4.7 | 4.7 | 4.7 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.2 | 15.2 | 15.2 | 15.2 | 0 |
| `GET /organizer/stats/live` | 66 | 200×66 | 91.5 | 292.5 | 381.0 | 381.0 | 0 |
| `GET /organizer/stats/process` | 66 | 200×66 | 92.8 | 293.1 | 382.5 | 382.5 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 11.5 | 21.5 | 21.5 | 21.5 | 0 |
| `POST /auth/login` | 300 | 200×300 | 488.3 | 586.0 | 593.4 | 619.6 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 491.4 | 594.0 | 602.1 | 611.1 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.2 | 4.6 | 4.6 | 4.6 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 8.1 | 8.6 | 8.6 | 8.6 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.5 | 9.5 | 9.5 | 9.5 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 7.7 | 7.7 | 7.7 | 7.7 | 0 |
| `POST /teams` | 100 | 201×100 | 14.9 | 25.0 | 26.5 | 27.5 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 16.4 | 28.9 | 65.9 | 67.7 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 67 | 200×67 | 3.4 | 70.0 | 392.6 | 392.6 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 3.4 | 71.4 | 302.4 | 302.4 | 0 |
| `POST /submissions` | 300 | 201×300 | 15019.3 | 18784.0 | 25023.2 | 26775.4 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.2 | 2.2 | 2.2 | 2.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /ranking` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.7 | 7.7 | 7.7 | 7.7 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.8 | 7.8 | 7.8 | 7.8 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 11.2 | 11.2 | 11.2 | 11.2 | 0 |

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
| correct | 270 | 14994.8 | 16386.2 | 18992.8 | 19373.2 |
| memory | 15 | 15284.4 | 18701.8 | 18701.8 | 18701.8 |
| loop | 15 | 24880.9 | 26775.5 | 26775.5 | 26775.5 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 88 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.98 / 0.99 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 14579.5 | 15789.3 | 16683.6 | 17189.3 |
| all | spawn | 300 | 298.6 | 397.3 | 497.7 | 506.6 |
| all | exec | 300 | 8.4 | 397.3 | 10076.9 | 10087.4 |
| all | total | 300 | 14899.2 | 16987.1 | 24982.7 | 26006.5 |
| passed | queue | 270 | 14583.9 | 15789.3 | 16895.4 | 17189.3 |
| passed | spawn | 270 | 298.4 | 398.4 | 498.4 | 506.6 |
| passed | exec | 270 | 8.2 | 99.6 | 185.5 | 205.6 |
| passed | total | 270 | 14886.6 | 16091.8 | 17190.6 | 17498.8 |
| runtime_error | queue | 15 | 14695.2 | 16385.4 | 16385.4 | 16385.4 |
| runtime_error | spawn | 15 | 299.7 | 378.0 | 378.0 | 378.0 |
| runtime_error | exec | 15 | 209.6 | 397.3 | 397.3 | 397.3 |
| runtime_error | total | 15 | 15198.7 | 16896.7 | 16896.7 | 16896.7 |
| timeout | queue | 15 | 14393.7 | 15699.7 | 15699.7 | 15699.7 |
| timeout | spawn | 15 | 303.2 | 479.7 | 479.7 | 479.7 |
| timeout | exec | 15 | 10011.6 | 10087.4 | 10087.4 | 10087.4 |
| timeout | total | 15 | 24774.5 | 26006.5 | 26006.5 | 26006.5 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 667.4 | 673.8 |
| 25 | 2309.9 | 2103.3 |
| 50 | 6012.3 | 5702.0 |
| 75 | 12406.5 | 11599.8 |
| 100 | 17189.3 | 16375.9 |

First k whose p95 queue wait passes 5000 ms: 46.

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
| load | heartbeat | 68 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 61 | 0 | 0.00 / 0.00 / 0.00 | 0.98 / 1.19 / 111.15 | 4.00 / 6.89 / 190.69 | 3.81 / 6.15 / 11.24 |

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

