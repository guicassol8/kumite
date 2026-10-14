# Load report: baseline `muxei4bq`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3443 |
| started | 2026-10-07T01:00:24.042Z |
| ended | 2026-10-07T01:02:10.856Z |
| node | v24.21.0 |
| commit | 685bfa8 |
| harness loadavg (1/5/15 min) at start | 1.80 / 1.75 / 2.20 |
| harness loadavg (1/5/15 min) at end | 6.86 / 3.02 / 2.57 |
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
| setupConcurrency | 32 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 60000 |
| cooldownMs | 5000 |
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/436/N32a/raw |
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
| rest | 30.1 | 0.9 | 1.5 | 278.8 | 66.6 | 1.1 | 1.1 | 0.007 | 0 | 0 | 30 |
| setup | 75.7 | 133.8 | 146.3 | 536.7 | 100.5 | 103.8 | 103.8 | 0.086 | 0 | 0 | 27 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| sse-idle | 1 | 31.7 | 31.7 | 281.7 | 69.8 | 1.6 | 1.6 | 0.372 | 0 | 0 | 1 |
| teardown | 0.0 | 1.2 | 1.2 | 281.7 | 70.5 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.7 | 9.0 | 0.004 | 0.023 | 10.7 | 11.2 | 1007 | 30 | — |
| setup | 2.2 | 10.4 | 0.016 | 0.075 | 15.5 | 32.3 | 4401 | 75 | — |
| sse-ramp | — | — | — | — | — | — | — | 0 | — |
| sse-idle | 12.7 | 12.7 | 0.079 | 0.079 | 10.8 | 11.6 | 1005 | 1 | — |
| teardown | 0.8 | 0.8 | 0.006 | 0.006 | 10.2 | 10.3 | 624 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 5.4 | 14.9 | 14.9 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 5.1 | 7.8 | 7.8 | 0 |
| `POST /auth/login` | 1 | 200×1 | 76.9 | 76.9 | 76.9 | 76.9 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.2 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.7 | 4.7 | 4.7 | 4.7 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 38.8 | 38.8 | 38.8 | 38.8 | 0 |
| `GET /organizer/stats/live` | 27 | 200×27 | 1802.3 | 3398.3 | 3398.6 | 3398.6 | 0 |
| `GET /organizer/stats/process` | 27 | 200×27 | 1801.3 | 3397.0 | 3398.1 | 3398.1 | 0 |
| `POST /auth/login` | 300 | 200×300 | 4291.7 | 6511.4 | 7008.5 | 7083.8 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 3486.4 | 5396.2 | 6298.1 | 6600.1 | 0 |
| `POST /teams` | 100 | 201×100 | 179.8 | 223.2 | 248.6 | 302.4 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 191.0 | 263.0 | 278.3 | 331.0 | 0 |

### sse-idle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |

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
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.03 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 76 | 0 | 0.00 / 0.01 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-idle | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

