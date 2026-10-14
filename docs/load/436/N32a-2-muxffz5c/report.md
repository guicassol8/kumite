# Load report: baseline `muxffz5c`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3443 |
| started | 2026-10-07T01:26:43.636Z |
| ended | 2026-10-07T01:28:26.294Z |
| node | v24.21.0 |
| commit | 685bfa8 |
| harness loadavg (1/5/15 min) at start | 1.54 / 2.81 / 2.82 |
| harness loadavg (1/5/15 min) at end | 0.56 / 2.05 / 2.54 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/436/N32a-2/raw |
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
| rest | 30.1 | 0.8 | 1.2 | 279.4 | 66.4 | 1.1 | 1.1 | 0.006 | 0 | 0 | 30 |
| setup | 71.6 | 133.0 | 146.6 | 491.2 | 98.7 | 92.8 | 92.8 | 0.076 | 0 | 0 | 31 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| sse-idle | 1.0 | 20.0 | 20.0 | 281.9 | 76.5 | 69.2 | 69.2 | 0.667 | 0 | 0 | 1 |
| teardown | 0.0 | 1.6 | 1.6 | 281.9 | 77.2 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.7 | 8.6 | 0.003 | 0.023 | 10.8 | 12.1 | 1008 | 30 | — |
| setup | 1.9 | 7.2 | 0.014 | 0.056 | 15.3 | 35.1 | 4380 | 71 | — |
| sse-ramp | — | — | — | — | — | — | — | 0 | — |
| sse-idle | 21.5 | 21.5 | 0.151 | 0.151 | 10.9 | 11.0 | 1002 | 1 | — |
| teardown | 0.6 | 0.6 | 0.005 | 0.005 | 10.3 | 10.4 | 171 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.3 | 5.4 | 6.8 | 6.8 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.1 | 5.0 | 8.4 | 8.4 | 0 |
| `POST /auth/login` | 1 | 200×1 | 81.0 | 81.0 | 81.0 | 81.0 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.7 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.9 | 15.9 | 15.9 | 15.9 | 0 |
| `GET /organizer/stats/live` | 31 | 200×31 | 1476.7 | 2296.6 | 3379.6 | 3379.6 | 0 |
| `GET /organizer/stats/process` | 31 | 200×31 | 1479.1 | 2296.6 | 3379.0 | 3379.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 3794.9 | 5495.5 | 6809.3 | 6894.6 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 3713.7 | 5096.2 | 5515.3 | 5669.6 | 0 |
| `POST /teams` | 100 | 201×100 | 47.6 | 56.6 | 66.6 | 67.2 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 69.8 | 79.0 | 81.0 | 90.0 | 0 |

### sse-idle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |

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
| setup | heartbeat | 72 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-idle | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

