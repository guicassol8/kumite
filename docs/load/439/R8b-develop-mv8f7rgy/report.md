# Load report: burst `mv8f7rgy`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3440 |
| started | 2026-10-14T18:05:48.374Z |
| ended | 2026-10-14T18:08:50.521Z |
| node | v24.21.0 |
| commit | a5050fc |
| harness loadavg (1/5/15 min) at start | 0.88 / 1.61 / 1.83 |
| harness loadavg (1/5/15 min) at end | 2.41 / 1.97 / 1.92 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3440 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3cbb33f2-aa81-414a-834c-d64a0a6449ee/scratchpad/t439-a798/runs/R8b/results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-mv8f7rgy (16e2c960-ad14-476c-ac48-4fbbea902341) |
| problem | 63264041-e724-4d9d-8b1f-6062897c498e |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.8 | 1.7 | 278.2 | 66.6 | 1.1 | 1.1 | 0.006 | 0 | 0 | 30 |
| setup | 71.7 | 133.6 | 147.3 | 477.6 | 98.9 | 89.2 | 89.2 | 0.080 | 0 | 0 | 65 |
| sse-ramp | 8.0 | 34.5 | 62.9 | 317.8 | 124.8 | 6.1 | 6.1 | 0.271 | 0 | 377 | 8 |
| load | 69.0 | 192.8 | 204.0 | 503.3 | 165.5 | 91.7 | 91.7 | 0.138 | 96 | 400 | 68 |
| settle | 0.3 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 2.9 | 101.3 | 133.5 | 565.4 | 275.4 | 12.1 | 12.1 | 0.746 | 0 | 400 | 3 |
| teardown | 0.1 | 68.2 | 68.2 | 565.4 | 184.7 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.7 | 8.9 | 0.003 | 0.024 | 10.9 | 11.4 | 1007 | 30 | — |
| setup | 2.3 | 11.9 | 0.017 | 0.044 | 14.2 | 15.2 | 1404 | 71 | — |
| sse-ramp | 17.2 | 25.8 | 0.122 | 0.179 | 11.5 | 11.6 | 1007 | 8 | — |
| load | 11.0 | 20.6 | 0.058 | 0.130 | 21.2 | 42.9 | 1252 | 69 | — |
| settle | 2.2 | 2.2 | 0.017 | 0.017 | 10.3 | 10.5 | — | 1 | — |
| storm | 56.0 | 69.7 | 0.422 | 0.553 | 64.1 | 136.6 | 1360 | 2 | — |
| teardown | 108.9 | 137.7 | 0.881 | 1 | 241.2 | 241.2 | 130 | 2 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up; a slow answer from the back widens it too, so it points at the harness only next to a high ELU or lag). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 5.6 | 15.6 | 15.6 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.1 | 8.3 | 8.3 | 0 |
| `POST /auth/login` | 1 | 200×1 | 81.1 | 81.1 | 81.1 | 81.1 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.7 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.4 | 4.4 | 4.4 | 4.4 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.8 | 4.8 | 4.8 | 4.8 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 14.8 | 14.8 | 14.8 | 14.8 | 0 |
| `GET /organizer/stats/live` | 65 | 200×65 | 92.0 | 301.1 | 402.2 | 402.2 | 0 |
| `GET /organizer/stats/process` | 65 | 200×65 | 91.9 | 301.9 | 403.7 | 403.7 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.3 | 11.8 | 11.8 | 11.8 | 0 |
| `POST /auth/login` | 300 | 200×300 | 486.2 | 581.9 | 592.9 | 604.7 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 493.2 | 581.0 | 601.5 | 606.9 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.0 | 4.9 | 4.9 | 4.9 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.5 | 7.0 | 7.0 | 7.0 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.9 | 9.9 | 9.9 | 9.9 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.2 | 8.2 | 8.2 | 8.2 | 0 |
| `POST /teams` | 100 | 201×100 | 7.9 | 10.4 | 12.5 | 13.1 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.4 | 13.7 | 20.2 | 22.3 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.4 | 6.6 | 6.6 | 6.6 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.3 | 6.6 | 6.6 | 6.6 | 0 |
| `GET /sse` | 400 | 200×400 | 2.3 | 3.1 | 7.6 | 14.8 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 68 | 200×68 | 3.2 | 71.2 | 251.3 | 251.3 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 3.2 | 72.1 | 251.3 | 251.3 | 0 |
| `POST /submissions` | 300 | 201×300 | 15290.8 | 20214.5 | 25917.9 | 26526.7 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /ranking` | 2 | 200×2 | 6.1 | 8.9 | 8.9 | 8.9 | 0 |
| `GET /rounds/:id/ranking` | 2 | 200×2 | 8.1 | 11.1 | 11.1 | 11.1 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 171.8 | 359.7 | 359.7 | 359.7 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 172.2 | 359.3 | 359.3 | 359.3 | 0 |
| `GET /ranking` | 3 | 200×3 | 586.8 | 1049.5 | 1049.5 | 1049.5 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 757.3 | 1050.3 | 1050.3 | 1050.3 | 0 |
| `GET /sse` | 400 | 200×400 | 266.7 | 473.2 | 485.3 | 488.5 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.8 | 6.8 | 6.8 | 6.8 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 6.7 | 6.7 | 6.7 | 6.7 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 36.9 | 36.9 | 36.9 | 36.9 | 0 |

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
| correct | 270 | 15219.2 | 17620.8 | 20386.0 | 20695.3 |
| memory | 15 | 15401.5 | 19788.6 | 19788.6 | 19788.6 |
| loop | 15 | 24910.1 | 26526.8 | 26526.8 | 26526.8 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.98 / 0.99 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 14813.0 | 16395.4 | 18928.3 | 19508.9 |
| all | spawn | 300 | 300.3 | 389.7 | 424.2 | 458.7 |
| all | exec | 300 | 10.6 | 319.6 | 10017.0 | 10085.6 |
| all | total | 300 | 15209.1 | 19393.1 | 25828.5 | 26510.5 |
| passed | queue | 270 | 14869.5 | 16690.1 | 19096.3 | 19508.9 |
| passed | spawn | 270 | 299.8 | 389.9 | 426.9 | 458.7 |
| passed | exec | 270 | 9.3 | 103.7 | 175.5 | 201.3 |
| passed | total | 270 | 15180.5 | 16906.2 | 19511.2 | 19887.6 |
| runtime_error | queue | 15 | 14707.3 | 18397.2 | 18397.2 | 18397.2 |
| runtime_error | spawn | 15 | 303.1 | 383.8 | 383.8 | 383.8 |
| runtime_error | exec | 15 | 230.1 | 319.6 | 319.6 | 319.6 |
| runtime_error | total | 15 | 15315.9 | 18934.7 | 18934.7 | 18934.7 |
| timeout | queue | 15 | 14586.4 | 16191.7 | 16191.7 | 16191.7 |
| timeout | spawn | 15 | 308.9 | 409.0 | 409.0 | 409.0 |
| timeout | exec | 15 | 10009.9 | 10085.6 | 10085.6 | 10085.6 |
| timeout | total | 15 | 24893.7 | 26510.5 | 26510.5 | 26510.5 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1016.9 | 1016.9 |
| 25 | 2701.9 | 2701.9 |
| 50 | 6679.0 | 6296.0 |
| 75 | 13498.5 | 12695.7 |
| 100 | 19508.9 | 18417.8 |

First k whose p95 queue wait passes 5000 ms: 44.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| payloads validated (distinct / reused) | 1646 / 56234 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 1017.1 / 1074.2 / 1074.3 / 1074.3 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 999.8 / 1003.8 / 1069.6 / 1074.3 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 70 | 73.7 | 78 |
| ranking.updated | 65 | 65 | 65 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 30680 | 60 | 60 | 60 |
| ranking.updated | 26400 | 28022 | 81858 | 91607 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.95 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 71 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 360 | 0.97 / 1.55 / 1.55 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 69 | 400 | 1.52 / 2.40 / 2.58 | — / — / — | — / — / — | — / — / — |
| load | ranking | 63 | 400 | 1.59 / 64.49 / 68.54 | 1.20 / 11.36 / 82.79 | 12.57 / 87.15 / 89.73 | 4.20 / 70.35 / 75.77 |
| settle | heartbeat | 1 | 400 | 1.46 / 1.46 / 1.46 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 1.47 / 1.47 / 1.47 | 6.97 / 6.97 / 6.97 | 4.03 / 4.03 / 4.03 | 3.02 / 3.02 / 3.02 |
| storm | heartbeat | 3 | 400 | 1.65 / 1.69 / 1.69 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — the frame encoded once, in the first subscriber (#439), plus N writes of it queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.0 / 1.1 / 3.2 | 5.2 / 6.5 / 8.5 / 10.6 | 6.2 / 7.8 / 9.6 / 11.6 | 1 |
| load | 1 | 1.0 / 1.0 / 1.0 / 1.0 | 5.7 / 5.7 / 5.7 / 5.7 | 6.8 / 6.8 / 6.8 / 6.8 | 1 |
| storm | 400 | 104.1 / 142.9 / 144.0 / 145.0 | 1532.3 / 1649.3 / 1660.4 / 1662.2 | 1675.1 / 1744.2 / 1751.7 / 1753.2 | 400 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 280 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 266.7 / 473.2 / 485.3 / 488.5 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 409.4 / 568.7 / 576.0 / 578.4 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2011.8 / 2509.6 / 2549.2 / 2560.1 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2338 ms) |

