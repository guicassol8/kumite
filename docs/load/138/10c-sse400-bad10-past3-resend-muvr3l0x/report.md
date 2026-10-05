# Load report: burst `muvr3l0x`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T21:17:28.501Z |
| ended | 2026-10-05T21:22:33.547Z |
| node | v24.21.0 |
| commit | b32ec95 |
| harness loadavg (1/5/15 min) at start | 0.89 / 2.12 / 1.92 |
| harness loadavg (1/5/15 min) at end | 3.06 / 2.81 / 2.27 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3137 |
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
| pastRounds | 3 |
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
| round | load-muvr3l0x (b6ee414c-c3be-400f-b6e7-921be91f3862) |
| problem | 478717e9-5193-4fb3-a0d7-204c529be144 |
| problems in the round | 5 |
| past rounds | load-muvr3l0x-r0, load-muvr3l0x-r1, load-muvr3l0x-r2 |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.8 | 280.0 | 67.2 | 6.8 | 6.8 | 0.007 | 0 | 0 | 30 |
| setup | 115.5 | 151.7 | 205.8 | 481.5 | 139.5 | 89.1 | 92.6 | 0.116 | 83 | 0 | 109 |
| sse-ramp | 8.0 | 64.6 | 149.6 | 430.4 | 162.2 | 69.4 | 69.4 | 0.409 | 0 | 370 | 8 |
| load | 130.5 | 167.3 | 201.6 | 1460.0 | 491.1 | 797.8 | 852.5 | 0.359 | 96 | 400 | 6 |
| settle | 14.6 | 22.6 | 80.1 | 1414.9 | 392.2 | 8.0 | 8.0 | 0.031 | 0 | 400 | 4 |
| storm | 6.1 | 95.8 | 129.3 | 1415.0 | 388.6 | 55.8 | 55.8 | 0.780 | 0 | 400 | 4 |
| teardown | 0.1 | 15.0 | 15.0 | 1325.3 | 250.7 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 5.7 | 16.3 | 16.3 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.3 | 9.3 | 9.3 | 0 |
| `POST /auth/login` | 1 | 200×1 | 98.8 | 98.8 | 98.8 | 98.8 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.6 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.0 | 4.0 | 4.0 | 4.0 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.3 | 5.3 | 5.3 | 5.3 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 31.3 | 31.3 | 31.3 | 31.3 | 0 |
| `GET /organizer/stats/live` | 109 | 200×109 | 10.1 | 199.8 | 373.5 | 384.5 | 0 |
| `GET /organizer/stats/process` | 109 | 200×109 | 11.1 | 199.3 | 299.2 | 386.1 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 43.3 | 50.3 | 50.3 | 50.3 | 0 |
| `POST /auth/login` | 300 | 200×300 | 482.4 | 581.4 | 594.3 | 615.2 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 498.7 | 600.3 | 681.4 | 728.2 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 33.1 | 34.6 | 34.6 | 34.6 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.4 | 7.1 | 7.1 | 7.1 | 0 |
| `POST /organizer/rounds` | 4 | 201×4 | 9.2 | 32.8 | 32.8 | 32.8 | 0 |
| `POST /organizer/rounds/:id/close` | 3 | 200×3 | 7.5 | 8.4 | 8.4 | 8.4 | 0 |
| `POST /organizer/rounds/:id/open` | 4 | 200×4 | 7.6 | 43.7 | 43.7 | 43.7 | 0 |
| `POST /submissions` | 380 | 201×300, 429:submission_throttled×80 | 4232.6 | 11321.5 | 13251.2 | 13460.7 | 0 |
| `POST /teams` | 100 | 201×100 | 33.4 | 90.5 | 94.4 | 94.7 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 33.2 | 90.3 | 181.5 | 182.5 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.7 | 5.4 | 5.4 | 5.4 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.9 | 5.4 | 5.4 | 5.4 | 0 |
| `GET /sse` | 400 | 200×400 | 2.8 | 4.4 | 22.0 | 59.4 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 6 | 200×6 | 5404.4 | 36425.3 | 36425.3 | 36425.3 | 0 |
| `GET /organizer/stats/process` | 6 | 200×6 | 5404.2 | 42918.0 | 42918.0 | 42918.0 | 0 |
| `POST /submissions` | 303 | 201×300, network×3 | 32849.7 | 44544.9 | 49131.2 | 54859.8 | 3 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 5 | 200×5 | 1837.9 | 10875.0 | 10875.0 | 10875.0 | 0 |
| `GET /organizer/stats/process` | 5 | 200×5 | 1837.8 | 10875.4 | 10875.4 | 10875.4 | 0 |
| `GET /ranking` | 6 | 200×6 | 846.8 | 2691.1 | 2691.1 | 2691.1 | 0 |
| `GET /rounds/:id/ranking` | 6 | 200×6 | 846.6 | 2691.2 | 2691.2 | 2691.2 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 4 | 200×4 | 211.3 | 1729.3 | 1729.3 | 1729.3 | 0 |
| `GET /organizer/stats/process` | 4 | 200×4 | 201.1 | 1728.4 | 1728.4 | 1728.4 | 0 |
| `GET /ranking` | 3 | 200×3 | 1724.8 | 3375.9 | 3375.9 | 3375.9 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 667.7 | 3375.5 | 3375.5 | 3375.5 | 0 |
| `GET /sse` | 400 | 200×400 | 311.6 | 347.4 | 350.8 | 352.3 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 17.0 | 17.0 | 17.0 | 17.0 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 16.4 | 16.4 | 16.4 | 16.4 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 29.8 | 29.8 | 29.8 | 29.8 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

| phase | route | after | count |
| --- | --- | --- | --- |
| load | `POST /submissions` | UND_ERR_SOCKET · request · reused | 3 |

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
| past-submission | 300 | 300 |
| submission | 300 | 300 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 270 | 31451.6 | 44460.2 | 49131.2 | 49131.9 |
| memory | 15 | 32979.7 | 42498.8 | 42498.8 | 42498.8 |
| loop | 15 | 40283.4 | 54859.8 | 54859.8 | 54859.8 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 600 / 600 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 2086.5 | 21325.3 | 25597.0 | 26519.3 |
| all | spawn | 300 | 477.1 | 916.9 | 970.4 | 978.1 |
| all | exec | 300 | 18.4 | 730.6 | 10178.3 | 10512.5 |
| all | total | 300 | 2810.5 | 21927.8 | 26523.9 | 33679.3 |
| passed | queue | 270 | 2086.0 | 21325.3 | 25597.3 | 26519.3 |
| passed | spawn | 270 | 477.6 | 914.7 | 950.8 | 978.1 |
| passed | exec | 270 | 14.2 | 332.6 | 534.8 | 637.7 |
| passed | total | 270 | 2732.7 | 21926.0 | 26523.9 | 27440.8 |
| runtime_error | queue | 15 | 2184.0 | 22882.5 | 22882.5 | 22882.5 |
| runtime_error | spawn | 15 | 509.5 | 963.5 | 963.5 | 963.5 |
| runtime_error | exec | 15 | 393.5 | 730.6 | 730.6 | 730.6 |
| runtime_error | total | 15 | 2969.7 | 23974.3 | 23974.3 | 23974.3 |
| timeout | queue | 15 | 1887.2 | 22877.9 | 22877.9 | 22877.9 |
| timeout | spawn | 15 | 402.5 | 977.3 | 977.3 | 977.3 |
| timeout | exec | 15 | 10084.3 | 10512.5 | 10512.5 | 10512.5 |
| timeout | total | 15 | 12735.0 | 33679.3 | 33679.3 | 33679.3 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1094.4 | 1095.5 |
| 25 | 3878.0 | 3878.0 |
| 50 | 9722.5 | 9212.1 |
| 75 | 18738.9 | 17098.3 |
| 100 | 26519.3 | 24707.5 |

First k whose p95 queue wait passes 5000 ms: 31.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 14587.7 / 17837.4 / 20946.7 / 23844.4 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 3.9 / 7005.8 / 12272.4 / 23844.4 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 145 | 149.0 | 153 |
| ranking.updated | 84 | 84.1 | 85 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 61986 | 60 | 60 | 60 |
| ranking.updated | 34024 | 67456 | 120918 | 130789 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 49.89 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 115 | 0 | 0.00 / 0.00 / 0.02 | — / — / — | — / — / — | — / — / — |
| setup | ranking | 39 | 0 | 0.00 / 0.00 / 0.00 | 1.19 / 89.12 / 199.68 | 4.79 / 114.58 / 609.01 | 80.14 / 85.98 / 88.53 |
| sse-ramp | heartbeat | 8 | 374 | 0.48 / 0.75 / 0.75 | — / — / — | — / — / — | — / — / — |
| sse-ramp | ranking | 1 | 24 | 2.33 / 2.33 / 2.33 | 1.23 / 1.23 / 1.23 | 4.30 / 4.30 / 4.30 | 12.68 / 12.68 / 12.68 |
| load | heartbeat | 130 | 400 | 1.11 / 1.77 / 77.15 | — / — / — | — / — / — | — / — / — |
| load | ranking | 83 | 400 | 264.32 / 497.68 / 600.70 | 1.48 / 83.40 / 94.99 | 16.03 / 99.75 / 109.67 | 23.48 / 97.32 / 281.99 |
| settle | heartbeat | 15 | 400 | 0.81 / 1.54 / 1.54 | — / — / — | — / — / — | — / — / — |
| storm | heartbeat | 6 | 400 | 0.15 / 1.09 / 1.09 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 1.0 / 1.4 / 3.6 / 4.0 | 10.8 / 14.4 / 20.8 / 23.1 | 12.2 / 15.8 / 22.0 / 24.2 | 4 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 14.7 / 14.7 / 14.7 / 14.7 | 16.2 / 16.2 / 16.2 / 16.2 | 1 |
| storm | 400 | 156.8 / 168.3 / 169.4 / 169.8 | 3711.7 / 4111.7 / 4132.3 / 4137.9 | 3868.0 / 4269.0 / 4289.5 / 4293.7 | 397 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 5839 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 8796 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 311.6 / 347.4 / 350.8 / 352.3 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 455.0 / 506.6 / 513.1 / 515.0 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 4789.4 / 5571.5 / 5668.0 / 5709.4 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 5651 ms) |

