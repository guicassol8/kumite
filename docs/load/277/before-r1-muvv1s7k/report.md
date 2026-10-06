# Load report: burst `muvv1s7k`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-05T23:08:02.964Z |
| ended | 2026-10-05T23:10:27.411Z |
| node | v24.21.0 |
| commit | a9beaf8 |
| harness loadavg (1/5/15 min) at start | 0.95 / 2.31 / 1.70 |
| harness loadavg (1/5/15 min) at end | 3.45 / 2.31 / 1.76 |
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
| round | load-muvv1s7k (7c8e4895-ffec-4145-85a2-90b353e88d10) |
| problem | 884d67d6-f9b6-4f91-bf38-ad6250c19648 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.1 | 8.1 | 280.0 | 84.5 | 13.4 | 13.4 | 0.007 | 0 | 0 | 30 |
| setup | 73.8 | 134.7 | 150.8 | 355.8 | 77.0 | 96.2 | 96.2 | 0.083 | 0 | 0 | 68 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 40.5 | 198.2 | 206.4 | 439.6 | 128.4 | 85.9 | 85.9 | 0.220 | 83 | 0 | 39 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| teardown | 0.0 | 177.3 | 177.3 | 419.7 | 122.4 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.6 | 5.9 | 18.3 | 18.3 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.4 | 5.6 | 9.3 | 9.3 | 0 |
| `POST /auth/login` | 1 | 200×1 | 80.2 | 80.2 | 80.2 | 80.2 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.5 | 5.5 | 5.5 | 5.5 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 17.0 | 17.0 | 17.0 | 17.0 | 0 |
| `GET /organizer/stats/live` | 68 | 200×68 | 85.5 | 217.8 | 306.6 | 306.6 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 86.6 | 218.6 | 308.2 | 308.2 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.5 | 11.6 | 11.6 | 11.6 | 0 |
| `POST /auth/login` | 300 | 200×300 | 492.7 | 588.9 | 598.1 | 694.3 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 497.3 | 596.3 | 606.1 | 687.3 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.0 | 5.2 | 5.2 | 5.2 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.2 | 7.2 | 7.2 | 7.2 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 10.8 | 10.8 | 10.8 | 10.8 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.4 | 8.4 | 8.4 | 8.4 | 0 |
| `POST /teams` | 100 | 201×100 | 8.1 | 11.7 | 16.9 | 17.0 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.8 | 15.0 | 19.7 | 22.0 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 39 | 200×39 | 4.1 | 81.4 | 688.1 | 688.1 | 0 |
| `GET /organizer/stats/process` | 39 | 200×39 | 4.1 | 81.2 | 282.4 | 282.4 | 0 |
| `POST /submissions` | 300 | 201×300 | 8014.0 | 12851.6 | 14364.8 | 14771.7 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /ranking` | 1 | 200×1 | 6.3 | 6.3 | 6.3 | 6.3 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.5 | 8.5 | 8.5 | 8.5 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /ranking` | 1 | 200×1 | 7.9 | 7.9 | 7.9 | 7.9 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 7.0 | 7.0 | 7.0 | 7.0 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 6.9 | 6.9 | 6.9 | 6.9 | 0 |

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
| correct | 300 | 8014.2 | 12851.7 | 14364.9 | 14771.8 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×300 |
| largest queue at an arrival (itself included) | 85 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.81 / 0.96 / 0.98 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 7370.5 | 10188.7 | 11617.1 | 12000.4 |
| all | spawn | 300 | 411.4 | 509.2 | 589.2 | 603.2 |
| all | exec | 300 | 99.5 | 188.6 | 199.2 | 264.8 |
| all | total | 300 | 7817.4 | 10692.7 | 12203.4 | 12603.9 |
| passed | queue | 300 | 7370.5 | 10188.7 | 11617.1 | 12000.4 |
| passed | spawn | 300 | 411.4 | 509.2 | 589.2 | 603.2 |
| passed | exec | 300 | 99.5 | 188.6 | 199.2 | 264.8 |
| passed | total | 300 | 7817.4 | 10692.7 | 12203.4 | 12603.9 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 192.2 | 598.2 |
| 25 | 2018.5 | 2018.5 |
| 50 | 5302.0 | 4923.0 |
| 75 | 8612.5 | 8292.0 |
| 100 | 11999.5 | 11486.8 |

First k whose p95 queue wait passes 5000 ms: 52.

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
| setup | heartbeat | 73 | 0 | 0.00 / 0.00 / 0.02 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 41 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | ranking | 39 | 0 | 0.00 / 0.00 / 0.00 | 1.18 / 5.78 / 6.60 | 5.48 / 10.71 / 15.08 | 4.89 / 87.41 / 89.74 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 4 ms (in flight 0, waiting 0, workers alive 0) |
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
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 13 ms) |

