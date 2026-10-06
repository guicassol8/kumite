# Load report: burst `muvunvvg`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-05T22:57:14.529Z |
| ended | 2026-10-05T22:58:42.102Z |
| node | v24.21.0 |
| commit | a9beaf8 |
| harness loadavg (1/5/15 min) at start | 0.97 / 0.75 / 0.46 |
| harness loadavg (1/5/15 min) at end | 3.67 / 1.48 / 0.73 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/37b2e0a4-59bf-4e73-a068-cc9e38cfbb0d/scratchpad/before/load-results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 1 |
| participants | 1 |
| members per team | 1 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvunvvg (d091324d-50d9-4723-a287-f70aa9ed2eaf) |
| problem | 8e5c41ff-7814-4624-bad5-cef12ca2e0a9 |
| problems in the round | 1 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.2 | 1.6 | 302.3 | 67.7 | 2.0 | 2.0 | 0.009 | 0 | 0 | 30 |
| setup | 0.3 | 24.8 | 24.8 | 366.5 | 70.7 | 20.3 | 20.3 | 0.035 | 0 | 0 | 1 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 57.1 | 6.9 | 43.9 | 357.8 | 102.4 | 15.6 | 15.6 | 0.013 | 0 | 0 | 56 |
| settle | 0.0 | 32.5 | 32.5 | 359.3 | 69.9 | — | — | — | 0 | 0 | 1 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 143.2 | 143.2 | 354.1 | 73.4 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.9 | 6.2 | 8.0 | 8.0 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.6 | 5.9 | 7.9 | 7.9 | 0 |
| `POST /auth/login` | 1 | 200×1 | 89.0 | 89.0 | 89.0 | 89.0 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 5.2 | 5.2 | 5.2 | 5.2 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 5.7 | 5.7 | 5.7 | 5.7 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 5.6 | 5.6 | 5.6 | 5.6 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 5.4 | 5.4 | 5.4 | 5.4 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 20.3 | 20.3 | 20.3 | 20.3 | 0 |
| `GET /organizer/stats/live` | 1 | 200×1 | 12.3 | 12.3 | 12.3 | 12.3 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 12.1 | 12.1 | 12.1 | 12.1 | 0 |
| `POST /auth/login` | 1 | 200×1 | 90.2 | 90.2 | 90.2 | 90.2 | 0 |
| `POST /auth/signup` | 1 | 201×1 | 73.8 | 73.8 | 73.8 | 73.8 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 14.2 | 14.2 | 14.2 | 14.2 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 32.7 | 32.7 | 32.7 | 32.7 | 0 |
| `POST /teams` | 1 | 201×1 | 13.0 | 13.0 | 13.0 | 13.0 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 56 | 200×56 | 3.4 | 4.3 | 5.3 | 5.3 | 0 |
| `GET /organizer/stats/process` | 56 | 200×56 | 3.2 | 4.1 | 6.3 | 6.3 | 0 |
| `POST /submissions` | 12 | 201×12 | 157.7 | 389.8 | 389.8 | 389.8 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 5.3 | 7.9 | 7.9 | 7.9 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 5.5 | 7.5 | 7.5 | 7.5 | 0 |
| `GET /ranking` | 1 | 200×1 | 8.8 | 8.8 | 8.8 | 8.8 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 11.2 | 11.2 | 11.2 | 11.2 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 12.1 | 12.1 | 12.1 | 12.1 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 11.8 | 11.8 | 11.8 | 11.8 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.4 | 5.4 | 5.4 | 5.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 5.2 | 5.2 | 5.2 | 5.2 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 13.3 | 13.3 | 13.3 | 13.3 | 0 |

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
| correct | 12 | 157.9 | 390.0 | 390.0 | 390.0 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 12 |
| by outcome | passed×12 |
| largest queue at an arrival (itself included) | 0 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.85 / 0.86 / 0.86 |
| workers spawned / exited / alive at the end | 12 / 12 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 12 | 0.0 | 0.1 | 0.1 | 0.1 |
| all | spawn | 12 | 98.8 | 129.2 | 129.2 | 129.2 |
| all | exec | 12 | 18.6 | 23.7 | 23.7 | 23.7 |
| all | total | 12 | 117.4 | 152.9 | 152.9 | 152.9 |
| passed | queue | 12 | 0.0 | 0.1 | 0.1 | 0.1 |
| passed | spawn | 12 | 98.8 | 129.2 | 129.2 | 129.2 |
| passed | exec | 12 | 18.6 | 23.7 | 23.7 | 23.7 |
| passed | total | 12 | 117.4 | 152.9 | 152.9 | 152.9 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 0.1 | 0.1 |

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
| rest | heartbeat | 31 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 57 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | ranking | 11 | 0 | 0.00 / 0.00 / 0.00 | 1.03 / 1.17 / 1.17 | 2.87 / 4.32 / 4.32 | 2.60 / 3.45 / 3.45 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 7 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 13 ms) |

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

