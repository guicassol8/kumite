# Load report: burst `muvvkt4r`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-05T23:22:50.623Z |
| ended | 2026-10-05T23:24:50.676Z |
| node | v24.21.0 |
| commit | c443ec8 |
| harness loadavg (1/5/15 min) at start | 0.94 / 1.31 / 1.50 |
| harness loadavg (1/5/15 min) at end | 0.73 / 1.04 / 1.37 |
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
| round | load-muvvkt4r (4a202e8b-4424-44c1-a95c-d9864e0e4f54) |
| problem | b151bcf5-5d52-4157-a963-2f8a08430957 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.3 | 8.6 | 281.0 | 84.3 | 15.6 | 15.6 | 0.009 | 0 | 0 | 30 |
| setup | 73.4 | 134.1 | 146.7 | 357.9 | 69.0 | 95.8 | 95.8 | 0.084 | 0 | 0 | 68 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 16.5 | 27.7 | 162.2 | 393.0 | 102.6 | 81.5 | 81.5 | 0.185 | 1 | 0 | 16 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 6.9 | 6.9 | 393.1 | 114.9 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.7 | 5.5 | 18.7 | 18.7 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.5 | 7.0 | 11.3 | 11.3 | 0 |
| `POST /auth/login` | 1 | 200×1 | 83.0 | 83.0 | 83.0 | 83.0 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.1 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 5.0 | 5.0 | 5.0 | 5.0 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.9 | 4.9 | 4.9 | 4.9 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 16.4 | 16.4 | 16.4 | 16.4 | 0 |
| `GET /organizer/stats/live` | 68 | 200×68 | 82.4 | 283.9 | 306.7 | 306.7 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 80.5 | 283.3 | 308.0 | 308.0 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.5 | 14.2 | 14.2 | 14.2 | 0 |
| `POST /auth/login` | 300 | 200×300 | 492.7 | 585.0 | 595.7 | 682.0 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 496.9 | 586.2 | 601.9 | 609.3 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.2 | 6.9 | 6.9 | 6.9 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.7 | 6.8 | 6.8 | 6.8 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 10.0 | 10.0 | 10.0 | 10.0 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 9.1 | 9.1 | 9.1 | 9.1 | 0 |
| `POST /teams` | 100 | 201×100 | 7.9 | 14.7 | 40.1 | 42.9 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 11.0 | 15.1 | 22.9 | 49.8 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 16 | 200×16 | 2.9 | 255.4 | 255.4 | 255.4 | 0 |
| `GET /organizer/stats/process` | 16 | 200×16 | 2.8 | 229.1 | 229.1 | 229.1 | 0 |
| `POST /submissions` | 300 | 201×300 | 258.6 | 1253.0 | 1262.8 | 1263.5 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /ranking` | 1 | 200×1 | 9.5 | 9.5 | 9.5 | 9.5 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.2 | 8.2 | 8.2 | 8.2 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 12.7 | 12.7 | 12.7 | 12.7 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 11.6 | 11.6 | 11.6 | 11.6 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 7.3 | 7.3 | 7.3 | 7.3 | 0 |

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
| correct | 300 | 258.7 | 1253.1 | 1262.9 | 1263.5 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×300 |
| largest queue at an arrival (itself included) | 12 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0 / 0 / 0.97 |
| workers spawned / exited / alive / idle at the end | 4 / 0 / 4 / 4 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 0.0 | 38.8 | 484.6 | 576.9 |
| all | spawn | 300 | 0 | 0 | 395.0 | 560.8 |
| all | exec | 300 | 8.6 | 26.1 | 82.6 | 204.7 |
| all | total | 300 | 9.2 | 151.2 | 599.8 | 657.7 |
| passed | queue | 300 | 0.0 | 38.8 | 484.6 | 576.9 |
| passed | spawn | 300 | 0 | 0 | 395.0 | 560.8 |
| passed | exec | 300 | 8.6 | 26.1 | 82.6 | 204.7 |
| passed | total | 300 | 9.2 | 151.2 | 599.8 | 657.7 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 403.7 | 576.9 |
| 25 | 15.6 | 574.4 |
| 50 | 0.0 | 572.1 |
| 75 | 3.3 | 484.6 |
| 100 | 2.1 | 403.7 |

First k whose p95 queue wait passes 5000 ms: none.

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
| setup | heartbeat | 73 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 17 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 5 | 0 | 0.00 / 0.00 / 0.00 | 1.11 / 39.77 / 39.77 | 4.89 / 114.77 / 114.77 | 3.85 / 6.18 / 6.18 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 4, idle 4) |
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
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 17 ms) |

