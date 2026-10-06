# Load report: burst `muvuvhp3`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3438 |
| started | 2026-10-05T23:03:09.403Z |
| ended | 2026-10-05T23:06:40.511Z |
| node | v24.21.0 |
| commit | 34d84bf |
| harness loadavg (1/5/15 min) at start | 0.96 / 2.18 / 1.34 |
| harness loadavg (1/5/15 min) at end | 3.60 / 3.02 / 1.85 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3438 |
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
| out | /home/guilherme/code/kumite/.claude/worktrees/agent-abb3e38d6ad1b20a6/load-results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvuvhp3 (977910ca-78f8-4822-b45c-9d05cee8db1b) |
| problem | f28bcb6a-2cac-4eb7-a4e8-fce0456d029d |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 1.8 | 296.9 | 67.3 | 5.1 | 5.1 | 0.007 | 0 | 0 | 30 |
| setup | 74.7 | 139.4 | 159.1 | 491.3 | 99.8 | 91.5 | 91.5 | 0.064 | 0 | 0 | 69 |
| sse-ramp | 8.0 | 45.2 | 93.5 | 317.8 | 120.5 | 17.3 | 17.3 | 0.388 | 0 | 364 | 8 |
| load | 88.1 | 191.9 | 207.3 | 745.2 | 157.6 | 672.3 | 672.3 | 0.436 | 90 | 400 | 12 |
| settle | 7.0 | 32.5 | 92.8 | 765.5 | 185.3 | 7.5 | 7.5 | 0.021 | 0 | 400 | 3 |
| storm | 3.0 | 85.2 | 132.3 | 730.2 | 271.6 | 11.4 | 11.4 | 0.690 | 0 | 400 | 3 |
| teardown | 0.1 | 77.9 | 77.9 | 730.2 | 174.0 | 8.5 | 8.5 | 0.402 | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 9.5 | 16.4 | 16.4 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.1 | 5.2 | 8.1 | 8.1 | 0 |
| `POST /auth/login` | 1 | 200×1 | 96.4 | 96.4 | 96.4 | 96.4 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.7 | 5.7 | 5.7 | 5.7 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.7 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.8 | 15.8 | 15.8 | 15.8 | 0 |
| `GET /organizer/stats/live` | 69 | 200×69 | 83.2 | 200.7 | 287.4 | 287.4 | 0 |
| `GET /organizer/stats/process` | 69 | 200×69 | 83.8 | 200.3 | 287.0 | 287.0 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.7 | 12.9 | 12.9 | 12.9 | 0 |
| `POST /auth/login` | 300 | 200×300 | 490.7 | 585.6 | 611.4 | 677.5 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 500.1 | 601.8 | 690.5 | 1048.3 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.0 | 6.1 | 6.1 | 6.1 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.9 | 8.0 | 8.0 | 8.0 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 11.2 | 11.2 | 11.2 | 11.2 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 10.1 | 10.1 | 10.1 | 10.1 | 0 |
| `POST /teams` | 100 | 201×100 | 9.0 | 14.2 | 16.1 | 16.4 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 12.0 | 17.4 | 40.6 | 47.2 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.8 | 4.0 | 4.0 | 4.0 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.8 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /sse` | 400 | 200×400 | 2.9 | 4.7 | 12.0 | 27.5 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 12 | 200×12 | 1018.3 | 18835.8 | 18835.8 | 18835.8 | 0 |
| `GET /organizer/stats/process` | 12 | 200×12 | 1018.1 | 18836.3 | 18836.3 | 18836.3 | 0 |
| `POST /submissions` | 300 | 201×300 | 20197.7 | 32543.9 | 38611.7 | 44599.0 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 4 | 200×4 | 1531.7 | 3788.8 | 3788.8 | 3788.8 | 0 |
| `GET /organizer/stats/process` | 4 | 200×4 | 1531.6 | 3788.8 | 3788.8 | 3788.8 | 0 |
| `GET /ranking` | 4 | 200×4 | 1060.7 | 1317.3 | 1317.3 | 1317.3 | 0 |
| `GET /rounds/:id/ranking` | 4 | 200×4 | 1061.3 | 1317.3 | 1317.3 | 1317.3 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 105.4 | 241.4 | 241.4 | 241.4 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 106.4 | 293.3 | 293.3 | 293.3 | 0 |
| `GET /ranking` | 3 | 200×3 | 672.8 | 1095.4 | 1095.4 | 1095.4 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 842.4 | 1095.8 | 1095.8 | 1095.8 | 0 |
| `GET /sse` | 400 | 200×400 | 286.3 | 466.3 | 478.3 | 481.5 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.4 | 6.4 | 6.4 | 6.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 6.3 | 6.3 | 6.3 | 6.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 42.1 | 42.1 | 42.1 | 42.1 | 0 |

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
| correct | 270 | 20196.9 | 32354.3 | 33519.6 | 33520.3 |
| memory | 15 | 20197.7 | 32544.0 | 32544.0 | 32544.0 |
| loop | 15 | 27505.8 | 44599.0 | 44599.0 | 44599.0 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 6411.0 | 21195.4 | 22319.5 | 23594.9 |
| all | spawn | 300 | 465.7 | 695.5 | 792.5 | 886.7 |
| all | exec | 300 | 11.6 | 629.1 | 10093.4 | 10597.1 |
| all | total | 300 | 7515.5 | 21810.9 | 28473.1 | 33406.7 |
| passed | queue | 270 | 6273.6 | 21195.4 | 22319.5 | 23594.9 |
| passed | spawn | 270 | 465.7 | 692.3 | 792.5 | 886.7 |
| passed | exec | 270 | 10.5 | 201.0 | 389.4 | 510.6 |
| passed | total | 270 | 6720.6 | 21785.2 | 22909.1 | 24192.4 |
| runtime_error | queue | 15 | 6715.0 | 22905.9 | 22905.9 | 22905.9 |
| runtime_error | spawn | 15 | 419.2 | 700.6 | 700.6 | 700.6 |
| runtime_error | exec | 15 | 209.6 | 629.1 | 629.1 | 629.1 |
| runtime_error | total | 15 | 7438.6 | 24207.7 | 24207.7 | 24207.7 |
| timeout | queue | 15 | 7511.5 | 22319.4 | 22319.4 | 22319.4 |
| timeout | spawn | 15 | 482.5 | 810.4 | 810.4 | 810.4 |
| timeout | exec | 15 | 10013.4 | 10597.1 | 10597.1 | 10597.1 |
| timeout | total | 15 | 18203.2 | 33406.7 | 33406.7 | 33406.7 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1202.5 | 1203.6 |
| 25 | 3712.9 | 3226.6 |
| 50 | 8503.0 | 8176.2 |
| 75 | 17482.2 | 16885.8 |
| 100 | 23594.9 | 22319.2 |

First k whose p95 queue wait passes 5000 ms: 33.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 8141.6 / 12485.6 / 15001.8 / 15156.1 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 3.5 / 6169.1 / 7897.3 / 15156.1 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 95 | 99.1 | 103 |
| ranking.updated | 79 | 79 | 79 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 40848 | 60 | 60 | 60 |
| ranking.updated | 32000 | 28022 | 81768 | 91768 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 35.01 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.04 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 75 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 381 | 0.39 / 0.97 / 0.97 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 88 | 400 | 1.02 / 1.60 / 77.55 | — / — / — | — / — / — | — / — / — |
| load | ranking | 78 | 400 | 205.73 / 311.87 / 394.63 | 1.80 / 91.58 / 101.23 | 22.89 / 98.87 / 287.76 | 5.28 / 82.78 / 102.44 |
| settle | heartbeat | 7 | 400 | 0.70 / 0.81 / 0.81 | — / — / — | — / — / — | — / — / — |
| storm | heartbeat | 3 | 400 | 0.43 / 0.72 / 0.72 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 1.0 / 1.3 / 1.7 / 4.0 | 6.4 / 8.7 / 10.2 / 14.8 | 7.7 / 10.1 / 12.2 / 16.1 | 2 |
| load | 1 | 1.1 / 1.1 / 1.1 / 1.1 | 5.6 / 5.6 / 5.6 / 5.6 | 6.8 / 6.8 / 6.8 / 6.8 | 1 |
| storm | 400 | 118.5 / 135.7 / 140.2 / 141.2 | 1624.7 / 1723.3 / 1732.0 / 1736.2 | 1752.6 / 1856.8 / 1863.9 / 1868.2 | 400 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 1728 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 5317 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 286.3 / 466.3 / 478.3 / 481.5 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 413.7 / 599.6 / 609.7 / 613.1 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2136.1 / 2628.8 / 2669.3 / 2678.3 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2463 ms) |

