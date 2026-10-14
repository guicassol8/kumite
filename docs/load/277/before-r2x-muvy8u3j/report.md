# Load report: burst `muvy8u3j`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-06T00:37:30.851Z |
| ended | 2026-10-06T00:40:29.222Z |
| node | v24.21.0 |
| commit | a9beaf8 |
| harness loadavg (1/5/15 min) at start | 0.98 / 2.41 / 2.83 |
| harness loadavg (1/5/15 min) at end | 3.36 / 2.34 / 2.69 |
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
| round | load-muvy8u3j (1bacc7b0-6e57-4d43-adfc-81b0e7f194e4) |
| problem | d8d6b039-87a6-4b8c-b33e-6379e5ba4e95 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.6 | 10.2 | 281.3 | 82.4 | 15.3 | 15.3 | 0.010 | 0 | 0 | 30 |
| setup | 80.0 | 119.6 | 150.4 | 356.3 | 66.2 | 94.7 | 94.7 | 0.078 | 0 | 0 | 75 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 68.3 | 193.4 | 205.4 | 473.6 | 108.0 | 81.5 | 81.5 | 0.095 | 84 | 0 | 67 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 95.5 | 95.5 | 378.4 | 68.5 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 4.4 | 7.1 | 20.6 | 20.6 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 4.0 | 6.9 | 10.3 | 10.3 | 0 |
| `POST /auth/login` | 1 | 200×1 | 84.9 | 84.9 | 84.9 | 84.9 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.7 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.9 | 4.9 | 4.9 | 4.9 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.6 | 4.6 | 4.6 | 4.6 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 16.7 | 16.7 | 16.7 | 16.7 | 0 |
| `GET /organizer/stats/live` | 75 | 200×75 | 81.5 | 283.6 | 296.2 | 296.2 | 0 |
| `GET /organizer/stats/process` | 75 | 200×75 | 84.6 | 283.2 | 296.0 | 296.0 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 11.6 | 13.1 | 13.1 | 13.1 | 0 |
| `POST /auth/login` | 300 | 200×300 | 486.9 | 583.1 | 593.1 | 658.3 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 498.4 | 605.7 | 2927.7 | 5148.0 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.0 | 4.5 | 4.5 | 4.5 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 8.6 | 9.3 | 9.3 | 9.3 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.2 | 9.2 | 9.2 | 9.2 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 9.7 | 9.7 | 9.7 | 9.7 | 0 |
| `POST /teams` | 100 | 201×100 | 39.7 | 102.7 | 111.8 | 113.3 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 42.1 | 97.9 | 112.1 | 117.5 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 67 | 200×67 | 3.5 | 70.6 | 272.4 | 272.4 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 3.4 | 72.5 | 271.6 | 271.6 | 0 |
| `POST /submissions` | 300 | 201×300 | 15100.3 | 18946.0 | 25099.1 | 26625.4 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /ranking` | 1 | 200×1 | 6.0 | 6.0 | 6.0 | 6.0 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.9 | 7.9 | 7.9 | 7.9 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 6.4 | 6.4 | 6.4 | 6.4 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.5 | 8.5 | 8.5 | 8.5 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 7.0 | 7.0 | 7.0 | 7.0 | 0 |

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
| correct | 270 | 15075.2 | 16324.8 | 19023.8 | 19342.3 |
| memory | 15 | 15493.1 | 18946.0 | 18946.0 | 18946.0 |
| loop | 15 | 24831.8 | 26625.5 | 26625.5 | 26625.5 |

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
| all | queue | 300 | 14622.7 | 15866.4 | 16509.6 | 17120.5 |
| all | spawn | 300 | 298.1 | 397.2 | 498.7 | 504.4 |
| all | exec | 300 | 9.5 | 311.4 | 10016.3 | 10085.2 |
| all | total | 300 | 14999.3 | 17107.9 | 25076.0 | 25903.7 |
| passed | queue | 270 | 14623.6 | 15890.9 | 16806.4 | 17120.5 |
| passed | spawn | 270 | 297.2 | 398.5 | 499.8 | 504.4 |
| passed | exec | 270 | 8.9 | 90.3 | 108.0 | 195.0 |
| passed | total | 270 | 14974.9 | 16201.1 | 17123.3 | 17501.5 |
| runtime_error | queue | 15 | 14803.3 | 16509.6 | 16509.6 | 16509.6 |
| runtime_error | spawn | 15 | 300.0 | 388.6 | 388.6 | 388.6 |
| runtime_error | exec | 15 | 214.8 | 311.4 | 311.4 | 311.4 |
| runtime_error | total | 15 | 15282.4 | 17107.9 | 17107.9 | 17107.9 |
| timeout | queue | 15 | 14493.2 | 15591.0 | 15591.0 | 15591.0 |
| timeout | spawn | 15 | 303.6 | 397.6 | 397.6 | 397.6 |
| timeout | exec | 15 | 10009.5 | 10085.2 | 10085.2 | 10085.2 |
| timeout | total | 15 | 24805.1 | 25903.7 | 25903.7 | 25903.7 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 902.0 | 974.6 |
| 25 | 2489.2 | 2198.4 |
| 50 | 5911.9 | 5607.9 |
| 75 | 12225.9 | 11324.3 |
| 100 | 17120.5 | 16208.8 |

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
| setup | heartbeat | 79 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 69 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 61 | 0 | 0.00 / 0.00 / 0.00 | 0.98 / 1.49 / 3.50 | 4.21 / 6.42 / 9.21 | 3.91 / 76.27 / 83.54 |

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

