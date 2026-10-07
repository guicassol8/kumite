# Load report: baseline `muxecroe`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3443 |
| started | 2026-10-07T00:56:14.370Z |
| ended | 2026-10-07T00:58:01.671Z |
| node | v24.21.0 |
| commit | 685bfa8 |
| harness loadavg (1/5/15 min) at start | 0.55 / 1.47 / 2.30 |
| harness loadavg (1/5/15 min) at end | 1.60 / 1.37 / 2.16 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/436/N16a/raw |
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
| rest | 30.1 | 1.0 | 1.6 | 280.0 | 66.4 | 0.9 | 0.9 | 0.008 | 0 | 0 | 30 |
| setup | 76.2 | 138.5 | 151.5 | 484.6 | 100.0 | 89.7 | 89.7 | 0.082 | 0 | 0 | 41 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| sse-idle | 1 | 91.2 | 91.2 | 282.8 | 71.5 | 1.1 | 1.1 | 0.131 | 0 | 0 | 1 |
| teardown | 0.0 | 1.0 | 1.0 | 282.8 | 72.3 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.8 | 8.7 | 0.004 | 0.023 | 10.7 | 16.6 | 1007 | 30 | — |
| setup | 2.5 | 17.6 | 0.019 | 0.117 | 17.5 | 25.3 | 2517 | 76 | — |
| sse-ramp | — | — | — | — | — | — | — | 0 | — |
| sse-idle | 8.7 | 8.7 | 0.076 | 0.076 | 10.9 | 11.0 | 1004 | 1 | — |
| teardown | 0.9 | 0.9 | 0.007 | 0.007 | 10.4 | 10.4 | 727 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 6.0 | 15.5 | 15.5 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 5.9 | 8.0 | 8.0 | 0 |
| `POST /auth/login` | 1 | 200×1 | 75.4 | 75.4 | 75.4 | 75.4 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.1 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 5.3 | 5.3 | 5.3 | 5.3 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 68.4 | 68.4 | 68.4 | 68.4 | 0 |
| `GET /organizer/stats/live` | 41 | 200×41 | 881.7 | 1396.2 | 1515.1 | 1515.1 | 0 |
| `GET /organizer/stats/process` | 41 | 200×41 | 882.7 | 1395.6 | 1514.6 | 1514.6 | 0 |
| `POST /auth/login` | 300 | 200×300 | 2012.4 | 2686.8 | 2922.4 | 3011.2 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 1988.9 | 2702.5 | 2981.2 | 3194.4 | 0 |
| `POST /teams` | 100 | 201×100 | 28.2 | 39.6 | 71.0 | 79.7 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 40.0 | 62.4 | 66.6 | 68.9 | 0 |

### sse-idle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |

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
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.05 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 76 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-idle | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

