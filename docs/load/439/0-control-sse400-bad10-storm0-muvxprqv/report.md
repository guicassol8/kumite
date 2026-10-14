# Load report: burst `muvxprqv`

**FAIL**

## Failures

- 21× network error on POST /submissions (load), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":21}
- submission: 300 started, 279 completed (21 never finished)

## Run

| field | value |
| --- | --- |
| target | http://localhost:3439 |
| started | 2026-10-06T00:22:41.340Z |
| ended | 2026-10-06T00:26:23.071Z |
| node | v24.21.0 |
| commit | a9beaf8 |
| harness loadavg (1/5/15 min) at start | 4.11 / 3.77 / 2.63 |
| harness loadavg (1/5/15 min) at end | 4.88 / 4.67 / 3.27 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3439 |
| teams | 100 |
| members | 3 |
| sse | 400 |
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
| out | /home/guilherme/code/kumite/.worktrees/task-439-fanout-sse-frame-unico/load-results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvxprqv (ebd210e6-1127-49e2-8fc8-d142783a8bff) |
| problem | e9572476-8b7a-4e60-8b4e-25c15cd9267f |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.3 | 2.3 | 297.2 | 69.2 | 2.9 | 2.9 | 0.010 | 0 | 0 | 30 |
| setup | 78.6 | 130.6 | 155.1 | 492.4 | 102.1 | 88.5 | 88.5 | 0.060 | 0 | 0 | 73 |
| sse-ramp | 8.0 | 36.3 | 47.0 | 309.2 | 107.9 | 16.0 | 16.0 | 0.296 | 0 | 359 | 8 |
| load | 98.9 | 177.3 | 204.4 | 700.2 | 172.7 | 793.0 | 793.0 | 0.395 | 92 | 400 | 16 |
| settle | 2.4 | 24.3 | 26.9 | 656.2 | 165.3 | 96.4 | 96.4 | 0.097 | 0 | 400 | 2 |
| storm | 3.6 | 112.6 | 138.1 | 641.7 | 139.1 | 46.5 | 46.5 | 0.651 | 0 | 400 | 2 |
| teardown | 0.1 | 23.1 | 23.1 | 641.7 | 149.9 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.9 | 9.8 | 19.4 | 19.4 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.6 | 10.9 | 11.1 | 11.1 | 0 |
| `POST /auth/login` | 1 | 200×1 | 127.2 | 127.2 | 127.2 | 127.2 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.9 | 3.9 | 3.9 | 3.9 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 5.4 | 5.4 | 5.4 | 5.4 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 6.1 | 6.1 | 6.1 | 6.1 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 14.3 | 14.3 | 14.3 | 14.3 | 0 |
| `GET /organizer/stats/live` | 73 | 200×73 | 76.0 | 214.6 | 283.7 | 283.7 | 0 |
| `GET /organizer/stats/process` | 73 | 200×73 | 77.1 | 215.9 | 284.5 | 284.5 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 102.8 | 113.0 | 113.0 | 113.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 485.9 | 585.4 | 599.3 | 678.1 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 499.9 | 630.4 | 825.6 | 943.4 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 41.5 | 53.8 | 53.8 | 53.8 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 8.2 | 52.9 | 52.9 | 52.9 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 103.8 | 103.8 | 103.8 | 103.8 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 9.9 | 9.9 | 9.9 | 9.9 | 0 |
| `POST /teams` | 100 | 201×100 | 51.4 | 148.7 | 237.4 | 237.4 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 49.6 | 102.7 | 164.3 | 165.0 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.9 | 4.6 | 4.6 | 4.6 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.8 | 5.2 | 5.2 | 5.2 | 0 |
| `GET /sse` | 400 | 200×400 | 2.9 | 4.7 | 17.4 | 33.5 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 16 | 200×16 | 939.7 | 35267.0 | 35267.0 | 35267.0 | 0 |
| `GET /organizer/stats/process` | 16 | 200×16 | 939.5 | 18504.6 | 18504.6 | 18504.6 | 0 |
| `POST /submissions` | 300 | 201×279, network×21 | 22545.8 | 41888.9 | 45482.9 | 54825.6 | 21 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 2.9 | 19.7 | 19.7 | 19.7 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 2.8 | 19.6 | 19.6 | 19.6 | 0 |
| `GET /ranking` | 6 | 200×6 | 7.1 | 502.6 | 502.6 | 502.6 | 0 |
| `GET /rounds/:id/ranking` | 6 | 200×6 | 9.0 | 508.0 | 508.0 | 508.0 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 97.2 | 1348.7 | 1348.7 | 1348.7 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 98.5 | 1345.3 | 1345.3 | 1345.3 | 0 |
| `GET /ranking` | 3 | 200×3 | 511.9 | 2017.3 | 2017.3 | 2017.3 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 543.1 | 2017.7 | 2017.7 | 2017.7 | 0 |
| `GET /sse` | 400 | 200×400 | 319.7 | 410.3 | 414.8 | 415.5 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.2 | 6.2 | 6.2 | 6.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 6.0 | 6.0 | 6.0 | 6.0 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 34.6 | 34.6 | 34.6 | 34.6 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 253 | 0 | 0 |
| memory | 0 | 13 | 0 |
| loop | 0 | 0 | 13 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |
| submission | 300 | 279 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 253 | 22529.3 | 40947.7 | 44013.4 | 44953.7 |
| memory | 13 | 23676.1 | 44953.1 | 44953.1 | 44953.1 |
| loop | 13 | 29396.3 | 54825.7 | 54825.7 | 54825.7 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 279 |
| by outcome | passed×253, runtime_error×13, timeout×13 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 279 / 279 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 279 | 5899.9 | 24024.2 | 25010.1 | 25090.6 |
| all | spawn | 279 | 506.0 | 865.5 | 944.0 | 963.2 |
| all | exec | 279 | 43.8 | 721.4 | 10120.2 | 10329.7 |
| all | total | 279 | 6820.7 | 25184.9 | 33301.7 | 34810.3 |
| passed | queue | 253 | 5899.9 | 24005.8 | 25009.2 | 25090.6 |
| passed | spawn | 253 | 504.6 | 864.2 | 933.6 | 963.2 |
| passed | exec | 253 | 14.9 | 327.2 | 511.0 | 529.1 |
| passed | total | 253 | 6294.3 | 24841.6 | 25584.7 | 25914.5 |
| runtime_error | queue | 13 | 5793.4 | 25010.1 | 25010.1 | 25010.1 |
| runtime_error | spawn | 13 | 492.3 | 885.7 | 885.7 | 885.7 |
| runtime_error | exec | 13 | 301.1 | 721.4 | 721.4 | 721.4 |
| runtime_error | total | 13 | 6673.8 | 26130.5 | 26130.5 | 26130.5 |
| timeout | queue | 13 | 7007.5 | 24066.2 | 24066.2 | 24066.2 |
| timeout | spawn | 13 | 582.9 | 945.2 | 945.2 | 945.2 |
| timeout | exec | 13 | 10031.2 | 10329.7 | 10329.7 | 10329.7 |
| timeout | total | 13 | 17609.0 | 34810.3 | 34810.3 | 34810.3 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1214.5 | 1260.6 |
| 25 | 4599.9 | 3981.1 |
| 50 | 10014.1 | 8497.7 |
| 75 | 17811.5 | 17403.2 |
| 100 | 24611.0 | 23167.6 |

First k whose p95 queue wait passes 5000 ms: 30.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 11879.9 / 12294.5 / 13164.9 / 22080.3 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 4.3 / 5378.2 / 10671.2 / 22080.3 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 101 | 105.2 | 109 |
| ranking.updated | 74 | 74 | 74 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 43688 | 60 | 60 | 60 |
| ranking.updated | 30000 | 28022 | 81014 | 91754 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 35.00 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 79 | 0 | 0.00 / 0.00 / 0.02 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 386 | 0.42 / 0.84 / 0.84 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 99 | 400 | 1.33 / 1.87 / 6.37 | — / — / — | — / — / — | — / — / — |
| load | ranking | 72 | 400 | 208.40 / 398.33 / 413.35 | 10.87 / 94.43 / 103.25 | 16.60 / 98.49 / 105.60 | 6.39 / 82.88 / 110.36 |
| settle | heartbeat | 2 | 400 | 0.72 / 0.75 / 0.75 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 57.36 / 57.36 / 57.36 | 0.87 / 0.87 / 0.87 | 14.97 / 14.97 / 14.97 | 4.27 / 4.27 / 4.27 |
| storm | heartbeat | 4 | 400 | 0.28 / 0.98 / 0.98 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 1.0 / 1.4 / 1.7 / 4.3 | 6.3 / 9.0 / 10.0 / 10.9 | 7.5 / 10.5 / 12.2 / 12.3 | 2 |
| load | 1 | 1.1 / 1.1 / 1.1 / 1.1 | 8.8 / 8.8 / 8.8 / 8.8 | 10.1 / 10.1 / 10.1 / 10.1 | 1 |
| storm | 400 | 199.7 / 216.9 / 217.2 / 217.5 | 1622.7 / 1978.8 / 2001.5 / 2010.1 | 1817.3 / 2150.0 / 2161.3 / 2173.2 | 396 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2403 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 319.7 / 410.3 / 414.8 / 415.5 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 519.9 / 563.9 / 567.7 / 569.0 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2601.9 / 3186.1 / 3220.6 / 3228.1 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 3083 ms) |

