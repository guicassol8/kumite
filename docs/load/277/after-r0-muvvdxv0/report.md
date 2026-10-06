# Load report: burst `muvvdxv0`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-05T23:17:30.161Z |
| ended | 2026-10-05T23:18:55.879Z |
| node | v24.21.0 |
| commit | c443ec8 |
| harness loadavg (1/5/15 min) at start | 0.98 / 1.87 / 1.74 |
| harness loadavg (1/5/15 min) at end | 0.24 / 1.40 / 1.59 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3277 |
| teams | 1 |
| members | 1 |
| sse | 0 |
| submissions | 12 |
| badFraction | 0 |
| memoryShare | 0.5 |
| problems | 1 |
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
| teams | 1 |
| participants | 1 |
| members per team | 1 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvvdxv0 (a7d3308f-ed96-4f7c-96e6-f5f2fe69d094) |
| problem | 23337a82-7417-4c47-ae38-4ea031299fc6 |
| problems in the round | 1 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 2.2 | 298.4 | 82.7 | 2.3 | 2.3 | 0.007 | 0 | 0 | 30 |
| setup | 0.2 | 15.4 | 15.4 | 299.0 | 87.7 | — | — | — | 0 | 0 | 1 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 55.4 | 2.0 | 30.9 | 328.2 | 98.9 | 17.1 | 17.1 | 0.010 | 0 | 0 | 55 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 19.2 | 19.2 | 186.6 | 53.1 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.6 | 5.9 | 21.8 | 21.8 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 5.7 | 11.0 | 11.0 | 0 |
| `POST /auth/login` | 1 | 200×1 | 96.0 | 96.0 | 96.0 | 96.0 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.7 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.1 | 15.1 | 15.1 | 15.1 | 0 |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.2 | 5.2 | 5.2 | 5.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 4.4 | 4.4 | 4.4 | 4.4 | 0 |
| `POST /auth/login` | 1 | 200×1 | 44.5 | 44.5 | 44.5 | 44.5 | 0 |
| `POST /auth/signup` | 1 | 201×1 | 51.7 | 51.7 | 51.7 | 51.7 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 34.2 | 34.2 | 34.2 | 34.2 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 9.4 | 9.4 | 9.4 | 9.4 | 0 |
| `POST /teams` | 1 | 201×1 | 8.2 | 8.2 | 8.2 | 8.2 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 55 | 200×55 | 3.5 | 4.4 | 4.6 | 4.6 | 0 |
| `GET /organizer/stats/process` | 55 | 200×55 | 3.2 | 4.3 | 4.5 | 4.5 | 0 |
| `POST /submissions` | 12 | 201×12 | 20.4 | 153.4 | 153.4 | 153.4 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |
| `GET /ranking` | 1 | 200×1 | 7.1 | 7.1 | 7.1 | 7.1 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 6.9 | 6.9 | 6.9 | 6.9 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 5.6 | 5.6 | 5.6 | 5.6 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 6.3 | 6.3 | 6.3 | 6.3 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 8.0 | 8.0 | 8.0 | 8.0 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted |
| --- | --- |
| correct | 12 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 1 | 1 |
| login | 1 | 1 |
| create-team | 1 | 1 |
| submission | 12 | 12 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 12 | 20.6 | 153.6 | 153.6 | 153.6 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 12 |
| by outcome | passed×12 |
| largest queue at an arrival (itself included) | 0 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0 / 0.85 / 0.85 |
| workers spawned / exited / alive / idle at the end | 1 / 0 / 1 / 1 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 12 | 0.0 | 0.0 | 0.0 | 0.0 |
| all | spawn | 12 | 0 | 101.8 | 101.8 | 101.8 |
| all | exec | 12 | 3.4 | 17.5 | 17.5 | 17.5 |
| all | total | 12 | 3.4 | 119.3 | 119.3 | 119.3 |
| passed | queue | 12 | 0.0 | 0.0 | 0.0 | 0.0 |
| passed | spawn | 12 | 0 | 101.8 | 101.8 | 101.8 |
| passed | exec | 12 | 3.4 | 17.5 | 17.5 | 17.5 |
| passed | total | 12 | 3.4 | 119.3 | 119.3 | 119.3 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 0.0 | 0.0 |

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
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.02 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 56 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 11 | 0 | 0.00 / 0.00 / 0.00 | 1.05 / 1.27 / 1.27 | 3.05 / 4.02 / 4.02 | 2.56 / 3.66 / 3.66 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 4 ms (in flight 0, waiting 0, workers alive 1, idle 1) |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 8 ms) |

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
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 7 ms) |

