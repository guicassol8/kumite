# Load report: baseline `muxflprr`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3443 |
| started | 2026-10-07T01:31:11.419Z |
| ended | 2026-10-07T01:32:54.433Z |
| node | v24.21.0 |
| commit | 685bfa8 |
| harness loadavg (1/5/15 min) at start | 1.80 / 2.12 / 2.48 |
| harness loadavg (1/5/15 min) at end | 6.05 / 3.09 / 2.76 |
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
| setupConcurrency | 64 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 60000 |
| cooldownMs | 5000 |
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/436/N64a-2/raw |
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
| rest | 30.1 | 0.8 | 1.2 | 278.9 | 66.4 | 1.0 | 1.0 | 0.006 | 0 | 0 | 30 |
| setup | 71.9 | 131.3 | 144.2 | 490.1 | 99.4 | 278.9 | 278.9 | 0.076 | 0 | 0 | 15 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| sse-idle | 1.0 | 63.5 | 63.5 | 282.7 | 69.4 | 1.8 | 1.8 | 0.143 | 0 | 0 | 1 |
| teardown | 0.0 | 0.8 | 0.8 | 282.7 | 70.1 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.7 | 8.5 | 0.003 | 0.022 | 10.8 | 11.1 | 1007 | 30 | — |
| setup | 1.8 | 11.8 | 0.013 | 0.084 | 22.6 | 25.9 | 8004 | 71 | — |
| sse-ramp | — | — | — | — | — | — | — | 0 | — |
| sse-idle | 13.8 | 13.8 | 0.112 | 0.112 | 11.0 | 17.1 | 1004 | 1 | — |
| teardown | 0.4 | 0.4 | 0.003 | 0.003 | 10.3 | 10.4 | 552 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.3 | 5.3 | 7.0 | 7.0 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.1 | 5.0 | 8.5 | 8.5 | 0 |
| `POST /auth/login` | 1 | 200×1 | 78.7 | 78.7 | 78.7 | 78.7 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.1 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.9 | 15.9 | 15.9 | 15.9 | 0 |
| `GET /organizer/stats/live` | 15 | 200×15 | 4587.2 | 7001.6 | 7001.6 | 7001.6 | 0 |
| `GET /organizer/stats/process` | 15 | 200×15 | 4588.9 | 7003.0 | 7003.0 | 7003.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 8710.8 | 12594.9 | 13809.1 | 14196.0 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 5599.1 | 12001.6 | 12975.4 | 13271.0 | 0 |
| `POST /teams` | 100 | 201×100 | 119.7 | 200.7 | 201.9 | 202.1 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 135.5 | 152.8 | 156.6 | 164.6 | 0 |

### sse-idle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.1 | 2.1 | 2.1 | 2.1 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |

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
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.04 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 72 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-idle | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

