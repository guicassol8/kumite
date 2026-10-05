# Load report: burst `muvodmgy`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:01:18.086Z |
| ended | 2026-10-05T20:02:44.978Z |
| node | v24.21.0 |
| commit | ed48fe6 |
| harness loadavg (1/5/15 min) at start | 1.04 / 1.73 / 1.05 |
| harness loadavg (1/5/15 min) at end | 0.37 / 1.33 / 0.96 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3137 |
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
| teams | 1 |
| participants | 1 |
| members per team | 1 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvodmgy (6a1ee4da-cca8-4775-9d61-7a4c83597a45) |
| problem | 38d2451f-c873-4c10-8e82-ae2d10a5d36e |
| problems in the round | 1 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.9 | 279.5 | 67.2 | 4.5 | 4.5 | 0.007 | 0 | 0 | 30 |
| setup | 0.2 | 16.0 | 16.0 | 343.7 | 70.4 | — | — | — | 0 | 0 | 1 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 56.5 | 5.9 | 32.8 | 331.1 | 98.9 | 6.6 | 6.6 | 0.010 | 0 | 0 | 56 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 67.5 | 67.5 | 324.3 | 60.9 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 5.6 | 18.6 | 18.6 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.1 | 5.4 | 10.7 | 10.7 | 0 |
| `POST /auth/login` | 1 | 200×1 | 91.5 | 91.5 | 91.5 | 91.5 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.6 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.0 | 4.0 | 4.0 | 4.0 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 17.7 | 17.7 | 17.7 | 17.7 | 0 |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.1 | 6.1 | 6.1 | 6.1 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 5.8 | 5.8 | 5.8 | 5.8 | 0 |
| `POST /auth/login` | 1 | 200×1 | 81.0 | 81.0 | 81.0 | 81.0 | 0 |
| `POST /auth/signup` | 1 | 201×1 | 60.8 | 60.8 | 60.8 | 60.8 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 11.0 | 11.0 | 11.0 | 11.0 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 9.4 | 9.4 | 9.4 | 9.4 | 0 |
| `POST /teams` | 1 | 201×1 | 8.6 | 8.6 | 8.6 | 8.6 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 56 | 200×56 | 3.1 | 3.7 | 4.5 | 4.5 | 0 |
| `GET /organizer/stats/process` | 56 | 200×56 | 2.9 | 3.6 | 4.3 | 4.3 | 0 |
| `POST /submissions` | 12 | 201×12 | 124.7 | 147.8 | 147.8 | 147.8 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /ranking` | 1 | 200×1 | 6.0 | 6.0 | 6.0 | 6.0 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 6.4 | 6.4 | 6.4 | 6.4 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 5.2 | 5.2 | 5.2 | 5.2 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 5.7 | 5.7 | 5.7 | 5.7 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 7.9 | 7.9 | 7.9 | 7.9 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

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
| correct | 12 | 125.0 | 148.1 | 148.1 | 148.1 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 12 |
| by outcome | passed×12 |
| largest queue at an arrival (itself included) | 0 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.85 / 0.87 / 0.87 |
| workers spawned / exited / alive at the end | 12 / 12 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 12 | 0.0 | 0.0 | 0.0 | 0.0 |
| all | spawn | 12 | 93.3 | 99.0 | 99.0 | 99.0 |
| all | exec | 12 | 16.1 | 17.3 | 17.3 | 17.3 |
| all | total | 12 | 108.4 | 116.4 | 116.4 | 116.4 |
| passed | queue | 12 | 0.0 | 0.0 | 0.0 | 0.0 |
| passed | spawn | 12 | 93.3 | 99.0 | 99.0 | 99.0 |
| passed | exec | 12 | 16.1 | 17.3 | 17.3 | 17.3 |
| passed | total | 12 | 108.4 | 116.4 | 116.4 | 116.4 |

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
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 57 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 11 | 0 | 0.00 / 0.00 / 0.00 | 0.99 / 1.15 / 1.15 | 2.84 / 4.16 / 4.16 | 2.46 / 3.29 / 3.29 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 4 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 7 ms) |

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
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 6 ms) |

