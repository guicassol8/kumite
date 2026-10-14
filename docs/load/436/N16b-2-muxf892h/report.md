# Load report: baseline `muxf892h`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3443 |
| started | 2026-10-07T01:20:43.245Z |
| ended | 2026-10-07T01:22:28.736Z |
| node | v24.21.0 |
| commit | 685bfa8 |
| harness loadavg (1/5/15 min) at start | 1.87 / 2.95 / 2.77 |
| harness loadavg (1/5/15 min) at end | 7.19 / 3.65 / 2.99 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | baseline |
| url | http://localhost:3443 |
| teams | 100 |
| members | 3 |
| sse | 0 |
| submissions | 0 |
| badFraction | 0 |
| memoryShare | 0 |
| problems | 1 |
| untilDone | false |
| storm | false |
| stormWindowSeconds | 0 |
| pastRounds | 0 |
| resendStale | false |
| restSeconds | 30 |
| durationSeconds | 1 |
| setupConcurrency | 16 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 60000 |
| cooldownMs | 5000 |
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/436/N16b-2/raw |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | — |
| problem | — |
| problems in the round | 0 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.8 | 1.5 | 279.4 | 66.5 | 3.8 | 3.8 | 0.006 | 0 | 0 | 30 |
| setup | 74.4 | 132.7 | 161.5 | 489.8 | 98.6 | 139.3 | 139.3 | 0.101 | 0 | 0 | 41 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| sse-idle | 1 | 44.1 | 44.1 | 282.7 | 74.4 | 3.5 | 3.5 | 0.495 | 0 | 0 | 1 |
| teardown | 0.0 | 1.4 | 1.4 | 282.7 | 75.1 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.7 | 8.4 | 0.003 | 0.022 | 10.9 | 11.1 | 1007 | 30 | — |
| setup | 2.6 | 20.4 | 0.025 | 0.255 | 25.5 | 32.2 | 2487 | 74 | — |
| sse-ramp | — | — | — | — | — | — | — | 0 | — |
| sse-idle | 6.3 | 6.3 | 0.099 | 0.099 | 17.0 | 19.9 | 1006 | 1 | — |
| teardown | 1.2 | 1.2 | 0.008 | 0.008 | 13.5 | 13.5 | 765 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.3 | 5.9 | 16.2 | 16.2 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.1 | 5.5 | 8.0 | 8.0 | 0 |
| `POST /auth/login` | 1 | 200×1 | 79.9 | 79.9 | 79.9 | 79.9 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.6 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 3.9 | 3.9 | 3.9 | 3.9 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.8 | 15.8 | 15.8 | 15.8 | 0 |
| `GET /organizer/stats/live` | 41 | 200×41 | 807.8 | 1336.2 | 1485.2 | 1485.2 | 0 |
| `GET /organizer/stats/process` | 41 | 200×41 | 807.3 | 1328.1 | 1484.4 | 1484.4 | 0 |
| `POST /auth/login` | 300 | 200×300 | 2083.5 | 2609.5 | 3011.8 | 3182.9 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 1722.2 | 2491.3 | 2863.6 | 3004.2 | 0 |
| `POST /teams` | 100 | 201×100 | 113.8 | 177.4 | 185.3 | 227.9 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 126.8 | 191.8 | 227.9 | 272.0 | 0 |

### sse-idle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 4.7 | 4.7 | 4.7 | 4.7 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 4.2 | 4.2 | 4.2 | 4.2 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 6.7 | 6.7 | 6.7 | 6.7 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

No submissions.

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |

## SSE

| field | value |
| --- | --- |
| requested | 0 |
| opened | 0 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 0 |
| invalid payloads | 0 |
| payloads validated (distinct / reused) | 0 / 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | — / — / — / — |
| heartbeat interval ms (p50 / p95 / p99 / max) | — / — / — / — |

| event | per connection min | mean | max |
| --- | --- | --- | --- |

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.01 / 0.03 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 74 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-idle | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

