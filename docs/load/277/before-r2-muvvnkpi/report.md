# Load report: burst `muvvnkpi`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-05T23:24:59.674Z |
| ended | 2026-10-05T23:27:52.375Z |
| node | v24.21.0 |
| commit | a9beaf8 |
| harness loadavg (1/5/15 min) at start | 0.78 / 1.04 / 1.37 |
| harness loadavg (1/5/15 min) at end | 1.51 / 1.41 / 1.46 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/37b2e0a4-59bf-4e73-a068-cc9e38cfbb0d/scratchpad/before/load-results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvvnkpi (1d760404-d8c1-47a2-8c8b-564602b8639b) |
| problem | 810244da-eb4a-49d0-ad65-20a64d3d1340 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.9 | 281.4 | 66.8 | 2.6 | 2.6 | 0.007 | 0 | 0 | 30 |
| setup | 73.0 | 133.5 | 148.5 | 475.7 | 100.5 | 90.0 | 90.0 | 0.076 | 0 | 0 | 67 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 69.6 | 193.1 | 209.5 | 530.3 | 132.0 | 87.4 | 87.4 | 0.105 | 83 | 0 | 68 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 96.5 | 96.5 | 399.0 | 62.3 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 6.3 | 16.2 | 16.2 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 5.9 | 8.7 | 8.7 | 0 |
| `POST /auth/login` | 1 | 200×1 | 80.4 | 80.4 | 80.4 | 80.4 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.2 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.8 | 4.8 | 4.8 | 4.8 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 17.0 | 17.0 | 17.0 | 17.0 | 0 |
| `GET /organizer/stats/live` | 67 | 200×67 | 90.2 | 292.7 | 307.7 | 307.7 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 89.2 | 290.8 | 307.5 | 307.5 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.4 | 11.8 | 11.8 | 11.8 | 0 |
| `POST /auth/login` | 300 | 200×300 | 490.2 | 588.6 | 597.4 | 685.3 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 495.9 | 590.3 | 600.0 | 608.6 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.7 | 4.6 | 4.6 | 4.6 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.7 | 7.6 | 7.6 | 7.6 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.5 | 9.5 | 9.5 | 9.5 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 7.8 | 7.8 | 7.8 | 7.8 | 0 |
| `POST /teams` | 100 | 201×100 | 7.6 | 13.7 | 14.6 | 14.7 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.5 | 13.8 | 22.1 | 23.6 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 68 | 200×68 | 3.4 | 76.9 | 502.1 | 502.1 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 3.5 | 76.7 | 486.8 | 486.8 | 0 |
| `POST /submissions` | 300 | 201×300 | 15300.2 | 19223.5 | 25423.1 | 28637.8 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /ranking` | 1 | 200×1 | 8.7 | 8.7 | 8.7 | 8.7 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.8 | 7.8 | 7.8 | 7.8 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 7.2 | 7.2 | 7.2 | 7.2 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 9.4 | 9.4 | 9.4 | 9.4 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 7.7 | 7.7 | 7.7 | 7.7 | 0 |

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
| correct | 270 | 15203.4 | 17420.1 | 19223.6 | 19829.2 |
| memory | 15 | 15687.2 | 19810.0 | 19810.0 | 19810.0 |
| loop | 15 | 25084.1 | 28637.9 | 28637.9 | 28637.9 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 84 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.98 / 0.99 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 14795.7 | 16592.8 | 16888.7 | 17318.8 |
| all | spawn | 300 | 303.1 | 482.3 | 511.9 | 614.2 |
| all | exec | 300 | 8.8 | 405.0 | 10013.8 | 10086.5 |
| all | total | 300 | 15180.1 | 17275.2 | 25408.3 | 26687.2 |
| passed | queue | 270 | 14789.9 | 16592.8 | 16888.7 | 17318.8 |
| passed | spawn | 270 | 302.6 | 482.3 | 515.5 | 614.2 |
| passed | exec | 270 | 8.4 | 98.9 | 200.7 | 210.1 |
| passed | total | 270 | 15097.9 | 16882.8 | 17272.3 | 17711.2 |
| runtime_error | queue | 15 | 15011.8 | 17106.1 | 17106.1 | 17106.1 |
| runtime_error | spawn | 15 | 299.6 | 500.4 | 500.4 | 500.4 |
| runtime_error | exec | 15 | 209.1 | 405.0 | 405.0 | 405.0 |
| runtime_error | total | 15 | 15593.4 | 17629.0 | 17629.0 | 17629.0 |
| timeout | queue | 15 | 14690.0 | 16297.9 | 16297.9 | 16297.9 |
| timeout | spawn | 15 | 305.1 | 491.9 | 491.9 | 491.9 |
| timeout | exec | 15 | 10010.2 | 10086.5 | 10086.5 | 10086.5 |
| timeout | total | 15 | 25072.5 | 26687.2 | 26687.2 | 26687.2 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 505.7 | 609.1 |
| 25 | 2300.3 | 1991.4 |
| 50 | 5904.0 | 5600.6 |
| 75 | 13213.5 | 12725.0 |
| 100 | 17318.8 | 16472.4 |

First k whose p95 queue wait passes 5000 ms: 47.

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
| load | heartbeat | 70 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 63 | 0 | 0.00 / 0.00 / 0.00 | 1.06 / 2.01 / 84.95 | 4.23 / 75.91 / 83.34 | 4.08 / 72.79 / 73.29 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
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
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 14 ms) |

