# Load report: baseline `muxef9wy`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3443 |
| started | 2026-10-07T00:58:11.318Z |
| ended | 2026-10-07T00:59:59.755Z |
| node | v24.21.0 |
| commit | 685bfa8 |
| harness loadavg (1/5/15 min) at start | 1.44 / 1.34 / 2.14 |
| harness loadavg (1/5/15 min) at end | 2.10 / 1.80 / 2.23 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/436/N16b/raw |
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
| rest | 30.1 | 1.2 | 1.8 | 278.5 | 66.4 | 2.4 | 2.4 | 0.009 | 0 | 0 | 30 |
| setup | 77.3 | 134.4 | 153.8 | 493.7 | 100.6 | 92.5 | 92.5 | 0.088 | 0 | 0 | 44 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| sse-idle | 1.0 | 24.9 | 24.9 | 281.6 | 74.0 | 1.1 | 1.1 | 0.118 | 0 | 0 | 1 |
| teardown | 0.0 | 1.0 | 1.0 | 281.6 | 74.7 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.9 | 9.0 | 0.005 | 0.026 | 10.7 | 11.2 | 1008 | 30 | — |
| setup | 2.4 | 11.4 | 0.017 | 0.065 | 16.7 | 18.2 | 2509 | 77 | — |
| sse-ramp | — | — | — | — | — | — | — | 0 | — |
| sse-idle | 8.5 | 8.5 | 0.039 | 0.039 | 10.7 | 12.0 | 1003 | 1 | — |
| teardown | 0.9 | 0.9 | 0.007 | 0.007 | 10.3 | 10.3 | 729 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.9 | 7.4 | 16.8 | 16.8 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.6 | 6.7 | 9.5 | 9.5 | 0 |
| `POST /auth/login` | 1 | 200×1 | 88.6 | 88.6 | 88.6 | 88.6 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 6.2 | 6.2 | 6.2 | 6.2 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 7.3 | 7.3 | 7.3 | 7.3 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 22.4 | 22.4 | 22.4 | 22.4 | 0 |
| `GET /organizer/stats/live` | 44 | 200×44 | 786.2 | 1303.5 | 1506.8 | 1506.8 | 0 |
| `GET /organizer/stats/process` | 44 | 200×44 | 783.8 | 1303.2 | 1506.8 | 1506.8 | 0 |
| `POST /auth/login` | 300 | 200×300 | 2088.1 | 2804.8 | 3317.1 | 3586.3 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 1898.4 | 2786.1 | 4055.0 | 4060.1 | 0 |
| `POST /teams` | 100 | 201×100 | 67.4 | 180.8 | 508.7 | 558.6 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 112.2 | 502.7 | 621.6 | 624.2 | 0 |

### sse-idle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |

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
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.02 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 77 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-idle | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

