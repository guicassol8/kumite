# Load report: burst `muvvrwfd`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-05T23:28:21.487Z |
| ended | 2026-10-05T23:30:21.148Z |
| node | v24.21.0 |
| commit | c443ec8 |
| harness loadavg (1/5/15 min) at start | 0.97 / 1.29 / 1.42 |
| harness loadavg (1/5/15 min) at end | 2.67 / 1.72 / 1.55 |
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
| round | load-muvvrwfd (181c18b9-5cb1-4332-b9d7-b42ea07bb0ca) |
| problem | 3425ef6e-083b-4350-91ee-94502e9bce95 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.6 | 279.5 | 72.0 | 1.0 | 1.0 | 0.007 | 0 | 0 | 30 |
| setup | 73 | 134.5 | 153.1 | 485.5 | 102.1 | 90.1 | 90.1 | 0.083 | 0 | 0 | 67 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 16.5 | 28.3 | 160.4 | 402.0 | 108.1 | 85.2 | 85.2 | 0.185 | 0 | 0 | 16 |
| settle | 0.0 | — | — | — | — | 0.4 | 0.4 | 0.007 | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 5.1 | 5.1 | 402.0 | 120.4 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 5.8 | 16.1 | 16.1 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.6 | 9.1 | 9.1 | 0 |
| `POST /auth/login` | 1 | 200×1 | 82.9 | 82.9 | 82.9 | 82.9 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.7 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.1 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 6.3 | 6.3 | 6.3 | 6.3 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 14.2 | 14.2 | 14.2 | 14.2 | 0 |
| `GET /organizer/stats/live` | 67 | 200×67 | 90.3 | 279.3 | 306.8 | 306.8 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 91.2 | 280.5 | 307.7 | 307.7 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.1 | 11.0 | 11.0 | 11.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 490.1 | 585.4 | 594.0 | 601.2 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 496.4 | 595.4 | 602.4 | 696.8 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.5 | 4.6 | 4.6 | 4.6 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.2 | 7.6 | 7.6 | 7.6 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.1 | 9.1 | 9.1 | 9.1 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 7.6 | 7.6 | 7.6 | 7.6 | 0 |
| `POST /teams` | 100 | 201×100 | 7.8 | 9.7 | 13.2 | 13.7 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.4 | 14.2 | 20.6 | 22.1 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 16 | 200×16 | 2.7 | 116.1 | 116.1 | 116.1 | 0 |
| `GET /organizer/stats/process` | 16 | 200×16 | 2.6 | 53.2 | 53.2 | 53.2 | 0 |
| `POST /submissions` | 300 | 201×300 | 290.0 | 1223.4 | 1234.2 | 1235.8 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /ranking` | 1 | 200×1 | 6.8 | 6.8 | 6.8 | 6.8 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.8 | 8.8 | 8.8 | 8.8 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 6.5 | 6.5 | 6.5 | 6.5 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 9.2 | 9.2 | 9.2 | 9.2 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 9.3 | 9.3 | 9.3 | 9.3 | 0 |

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
| correct | 300 | 290.2 | 1223.5 | 1234.3 | 1235.8 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×300 |
| largest queue at an arrival (itself included) | 13 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0 / 0 / 0.79 |
| workers spawned / exited / alive / idle at the end | 4 / 0 / 4 / 4 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 0.0 | 22.1 | 45.0 | 548.3 |
| all | spawn | 300 | 0 | 0 | 422.4 | 438.6 |
| all | exec | 300 | 8.1 | 25.5 | 118.9 | 141.0 |
| all | total | 300 | 9.3 | 41.8 | 563.4 | 611.5 |
| passed | queue | 300 | 0.0 | 22.1 | 45.0 | 548.3 |
| passed | spawn | 300 | 0 | 0 | 422.4 | 438.6 |
| passed | exec | 300 | 8.1 | 25.5 | 118.9 | 141.0 |
| passed | total | 300 | 9.3 | 41.8 | 563.4 | 611.5 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 0.0 | 548.3 |
| 25 | 44.2 | 546.1 |
| 50 | 0.0 | 531.6 |
| 75 | 1.6 | 45.0 |
| 100 | 2.3 | 8.6 |

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
| setup | heartbeat | 72 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 17 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 6 | 0 | 0.00 / 0.00 / 0.00 | 0.90 / 35.33 / 35.33 | 3.57 / 157.97 / 157.97 | 3.62 / 142.43 / 142.43 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 4, idle 4) |
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

