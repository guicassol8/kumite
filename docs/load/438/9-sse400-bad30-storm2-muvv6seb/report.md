# Load report: burst `muvv6seb`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3438 |
| started | 2026-10-05T23:11:56.487Z |
| ended | 2026-10-05T23:16:22.736Z |
| node | v24.21.0 |
| commit | 34d84bf |
| harness loadavg (1/5/15 min) at start | 0.85 / 1.75 / 1.60 |
| harness loadavg (1/5/15 min) at end | 2.53 / 2.25 / 1.85 |
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
| badFraction | 0.3 |
| memoryShare | 0.5 |
| problems | 5 |
| untilDone | true |
| storm | true |
| stormWindowSeconds | 2 |
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
| round | load-muvv6seb (f2cfc3bf-aa75-4963-8c6f-ac561738e0c2) |
| problem | 566231dc-6490-4301-97de-f2ffa6172c32 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.8 | 279.9 | 66.7 | 1.1 | 1.1 | 0.007 | 0 | 0 | 30 |
| setup | 73.5 | 134.0 | 153.8 | 479.7 | 101.2 | 89.1 | 89.1 | 0.068 | 0 | 0 | 67 |
| sse-ramp | 8.0 | 42.1 | 103.2 | 317.2 | 122.3 | 26.4 | 26.4 | 0.341 | 0 | 358 | 8 |
| load | 150.6 | 196.7 | 206.8 | 763.1 | 198.6 | 500.3 | 508.6 | 0.314 | 95 | 400 | 48 |
| settle | 1.4 | 82.2 | 82.2 | 629.4 | 197.8 | 94.2 | 94.2 | 0.131 | 0 | 400 | 1 |
| storm | 2.5 | 102.0 | 119.5 | 665.9 | 273.7 | 4.2 | 4.2 | 0.766 | 0 | 341 | 2 |
| teardown | 0.1 | 104.5 | 104.5 | 669.5 | 139.7 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 5.7 | 15.8 | 15.8 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.4 | 8.2 | 8.2 | 0 |
| `POST /auth/login` | 1 | 200×1 | 79.0 | 79.0 | 79.0 | 79.0 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.0 | 4.0 | 4.0 | 4.0 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.5 | 5.5 | 5.5 | 5.5 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 16.3 | 16.3 | 16.3 | 16.3 | 0 |
| `GET /organizer/stats/live` | 67 | 200×67 | 82.9 | 379.0 | 397.3 | 397.3 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 84.4 | 378.3 | 397.1 | 397.1 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.5 | 11.4 | 11.4 | 11.4 | 0 |
| `POST /auth/login` | 300 | 200×300 | 492.8 | 587.8 | 600.7 | 677.7 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 494.7 | 588.6 | 597.8 | 602.6 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.4 | 4.2 | 4.2 | 4.2 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.0 | 7.2 | 7.2 | 7.2 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.6 | 9.6 | 9.6 | 9.6 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 7.6 | 7.6 | 7.6 | 7.6 | 0 |
| `POST /teams` | 100 | 201×100 | 8.8 | 12.4 | 13.3 | 13.8 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.8 | 15.4 | 22.9 | 26.4 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.5 | 7.4 | 7.4 | 7.4 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.4 | 8.5 | 8.5 | 8.5 | 0 |
| `GET /sse` | 400 | 200×400 | 2.5 | 3.4 | 9.4 | 29.0 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 48 | 200×48 | 3.9 | 14036.5 | 25975.2 | 25975.2 | 0 |
| `GET /organizer/stats/process` | 48 | 200×48 | 3.7 | 14036.3 | 25975.7 | 25975.7 | 0 |
| `POST /submissions` | 300 | 201×300 | 43578.1 | 59066.1 | 64842.7 | 67485.0 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 2.2 | 558.8 | 558.8 | 558.8 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 2.6 | 559.2 | 559.2 | 559.2 | 0 |
| `GET /ranking` | 3 | 200×3 | 9.6 | 558.6 | 558.6 | 558.6 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 8.3 | 562.7 | 562.7 | 562.7 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 21.7 | 36.0 | 36.0 | 36.0 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 23.2 | 35.8 | 35.8 | 35.8 | 0 |
| `GET /ranking` | 2 | 200×2 | 8.1 | 146.3 | 146.3 | 146.3 | 0 |
| `GET /rounds/:id/ranking` | 2 | 200×2 | 7.2 | 168.4 | 168.4 | 168.4 | 0 |
| `GET /sse` | 400 | 200×400 | 27.6 | 42.7 | 52.7 | 59.2 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.4 | 5.4 | 5.4 | 5.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 5.8 | 5.8 | 5.8 | 5.8 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 43.1 | 43.1 | 43.1 | 43.1 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 210 | 0 | 0 |
| memory | 0 | 45 | 0 |
| loop | 0 | 0 | 45 |

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
| correct | 210 | 42522.4 | 54726.7 | 58087.2 | 59841.7 |
| memory | 45 | 44904.9 | 55441.7 | 58950.4 | 58950.4 |
| loop | 45 | 51309.2 | 65493.4 | 67485.1 | 67485.1 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×210, runtime_error×45, timeout×45 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 33619.7 | 43105.7 | 45399.2 | 45690.1 |
| all | spawn | 300 | 307.4 | 619.9 | 704.5 | 802.2 |
| all | exec | 300 | 16.0 | 10081.8 | 10386.1 | 10415.7 |
| all | total | 300 | 35581.6 | 47991.6 | 52662.8 | 55608.2 |
| passed | queue | 210 | 33322.2 | 43105.7 | 45399.2 | 45613.9 |
| passed | spawn | 210 | 305.2 | 603.6 | 690.7 | 798.4 |
| passed | exec | 210 | 7.6 | 101.2 | 327.1 | 418.4 |
| passed | total | 210 | 33620.5 | 43399.6 | 45764.8 | 45915.5 |
| runtime_error | queue | 45 | 35309.6 | 44632.5 | 45690.1 | 45690.1 |
| runtime_error | spawn | 45 | 298.5 | 678.9 | 686.8 | 686.8 |
| runtime_error | exec | 45 | 221.0 | 523.5 | 599.9 | 599.9 |
| runtime_error | total | 45 | 35740.9 | 45188.9 | 46414.5 | 46414.5 |
| timeout | queue | 45 | 30215.6 | 42694.3 | 44907.8 | 44907.8 |
| timeout | spawn | 45 | 314.6 | 685.2 | 802.2 | 802.2 |
| timeout | exec | 45 | 10010.1 | 10399.7 | 10415.7 | 10415.7 |
| timeout | total | 45 | 40907.5 | 53017.6 | 55608.2 | 55608.2 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1098.8 | 1100.3 |
| 25 | 3687.6 | 3294.1 |
| 50 | 22630.0 | 21926.9 |
| 75 | 29393.6 | 28485.6 |
| 100 | 42310.3 | 40677.3 |

First k whose p95 queue wait passes 5000 ms: 32.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 9592.9 / 16178.6 / 18579.0 / 18614.7 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 301.3 / 5114.9 / 8853.3 / 18614.7 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 152 | 156.1 | 160 |
| ranking.updated | 115 | 115 | 115 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 62848 | 60 | 60 | 60 |
| ranking.updated | 46400 | 28022 | 82713 | 91571 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.93 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 73 | 0 | 0.00 / 0.01 / 0.03 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 380 | 0.43 / 0.75 / 0.75 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 150 | 400 | 0.94 / 1.47 / 71.07 | — / — / — | — / — / — | — / — / — |
| load | ranking | 113 | 400 | 193.02 / 297.33 / 303.66 | 8.79 / 79.73 / 89.37 | 16.50 / 88.98 / 157.40 | 4.98 / 68.96 / 100.93 |
| settle | heartbeat | 2 | 400 | 0.74 / 0.87 / 0.87 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 58.48 / 58.48 / 58.48 | 2.40 / 2.40 / 2.40 | 10.97 / 10.97 / 10.97 | 3.62 / 3.62 / 3.62 |
| storm | heartbeat | 2 | 304 | 0.21 / 0.60 / 0.60 | — / — / — | — / — / — | — / — / — |
| teardown | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.9 / 1.2 / 1.5 / 2.5 | 5.6 / 8.1 / 11.9 / 15.7 | 6.7 / 9.3 / 13.2 / 16.7 | 2 |
| load | 1 | 1.0 / 1.0 / 1.0 / 1.0 | 5.8 / 5.8 / 5.8 / 5.8 | 7.0 / 7.0 / 7.0 / 7.0 | 1 |
| storm | 400 | 24.6 / 38.2 / 44.6 / 48.5 | 257.2 / 344.0 / 351.7 / 354.4 | 282.2 / 375.7 / 384.5 / 390.4 | 76 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 1438 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 2 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 27.6 / 42.7 / 52.7 / 59.2 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 52.1 / 78.7 / 86.7 / 91.0 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 311.3 / 417.3 / 422.7 / 426.7 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 436 ms) |

