# Load report: burst `muvog5l4`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:03:16.172Z |
| ended | 2026-10-05T20:05:35.494Z |
| node | v24.21.0 |
| commit | ed48fe6 |
| harness loadavg (1/5/15 min) at start | 0.37 / 1.24 / 0.94 |
| harness loadavg (1/5/15 min) at end | 1.89 / 1.59 / 1.11 |
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
| badFraction | 0 |
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
| round | load-muvog5l4 (b3ced1ec-4f92-4413-9672-ebc5e94bf501) |
| problem | 34189450-3f9e-44d9-a8a9-17bfdfbf668c |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.8 | 279.0 | 67.3 | 2.4 | 2.4 | 0.007 | 0 | 0 | 30 |
| setup | 71.9 | 133.5 | 156.9 | 474.0 | 100.8 | 86.9 | 86.9 | 0.074 | 0 | 0 | 66 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 37.3 | 197.8 | 205.0 | 469.8 | 120.2 | 82.2 | 82.2 | 0.200 | 84 | 0 | 36 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 187.9 | 187.9 | 433.4 | 58.2 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 6.3 | 16.0 | 16.0 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.1 | 5.8 | 9.0 | 9.0 | 0 |
| `POST /auth/login` | 1 | 200×1 | 89.6 | 89.6 | 89.6 | 89.6 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.0 | 4.0 | 4.0 | 4.0 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.6 | 4.6 | 4.6 | 4.6 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 16.5 | 16.5 | 16.5 | 16.5 | 0 |
| `GET /organizer/stats/live` | 66 | 200×66 | 85.5 | 291.1 | 378.6 | 378.6 | 0 |
| `GET /organizer/stats/process` | 66 | 200×66 | 85.3 | 292.4 | 378.0 | 378.0 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 8.4 | 11.1 | 11.1 | 11.1 | 0 |
| `POST /auth/login` | 300 | 200×300 | 488.6 | 583.9 | 591.1 | 599.3 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 491.0 | 591.7 | 601.6 | 605.2 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.1 | 5.6 | 5.6 | 5.6 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 5.6 | 6.6 | 6.6 | 6.6 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.9 | 9.9 | 9.9 | 9.9 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.1 | 8.1 | 8.1 | 8.1 | 0 |
| `POST /teams` | 100 | 201×100 | 7.2 | 11.1 | 15.6 | 16.4 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.2 | 14.3 | 18.8 | 24.2 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 36 | 200×36 | 4.1 | 75.7 | 596.2 | 596.2 | 0 |
| `GET /organizer/stats/process` | 36 | 200×36 | 3.8 | 75.3 | 278.4 | 278.4 | 0 |
| `POST /submissions` | 300 | 201×300 | 7313.4 | 11042.6 | 12558.3 | 12558.6 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /ranking` | 1 | 200×1 | 8.4 | 8.4 | 8.4 | 8.4 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 11.5 | 11.5 | 11.5 | 11.5 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 6.7 | 6.7 | 6.7 | 6.7 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 9.5 | 9.5 | 9.5 | 9.5 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 7.0 | 7.0 | 7.0 | 7.0 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

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
| correct | 300 | 7313.5 | 11042.7 | 12558.4 | 12558.7 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×300 |
| largest queue at an arrival (itself included) | 88 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.79 / 0.95 / 0.97 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 6703.9 | 8802.8 | 10200.3 | 10209.2 |
| all | spawn | 300 | 395.4 | 478.5 | 495.1 | 594.7 |
| all | exec | 300 | 102.6 | 188.0 | 195.8 | 204.2 |
| all | total | 300 | 7204.3 | 9290.8 | 10708.4 | 10710.1 |
| passed | queue | 300 | 6703.9 | 8802.8 | 10200.3 | 10209.2 |
| passed | spawn | 300 | 395.4 | 478.5 | 495.1 | 594.7 |
| passed | exec | 300 | 102.6 | 188.0 | 195.8 | 204.2 |
| passed | total | 300 | 7204.3 | 9290.8 | 10708.4 | 10710.1 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 573.6 | 573.6 |
| 25 | 2300.3 | 1900.9 |
| 50 | 4706.2 | 4293.0 |
| 75 | 7491.7 | 7016.8 |
| 100 | 10209.2 | 9719.0 |

First k whose p95 queue wait passes 5000 ms: 55.

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
| setup | heartbeat | 71 | 0 | 0.00 / 0.01 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 38 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 36 | 0 | 0.00 / 0.00 / 0.00 | 1.10 / 2.71 / 2.92 | 4.89 / 10.89 / 13.80 | 4.79 / 15.13 / 84.19 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 19 ms) |

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

