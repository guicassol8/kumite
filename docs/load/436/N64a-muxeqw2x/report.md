# Load report: baseline `muxeqw2x`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3443 |
| started | 2026-10-07T01:07:13.262Z |
| ended | 2026-10-07T01:08:58.999Z |
| node | v24.21.0 |
| commit | 685bfa8 |
| harness loadavg (1/5/15 min) at start | 1.53 / 2.46 / 2.44 |
| harness loadavg (1/5/15 min) at end | 2.11 / 2.15 / 2.31 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/436/N64a/raw |
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
| rest | 30.1 | 0.9 | 1.6 | 279.4 | 66.4 | 1.8 | 1.8 | 0.007 | 0 | 0 | 30 |
| setup | 74.6 | 128.8 | 144.7 | 536.8 | 99.3 | 182.6 | 182.6 | 0.088 | 0 | 0 | 13 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| sse-idle | 1 | 10.6 | 10.6 | 282.0 | 73.1 | 3.8 | 3.8 | 0.459 | 0 | 0 | 1 |
| teardown | 0.0 | 1.7 | 1.7 | 282.0 | 73.8 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.8 | 9.7 | 0.004 | 0.027 | 10.8 | 11.9 | 1008 | 30 | — |
| setup | 2.2 | 16.3 | 0.015 | 0.087 | 17.5 | 23.9 | 8192 | 74 | — |
| sse-ramp | — | — | — | — | — | — | — | 0 | — |
| sse-idle | 17.5 | 17.5 | 0.104 | 0.104 | 12.4 | 12.5 | 1004 | 1 | — |
| teardown | 0.8 | 0.8 | 0.006 | 0.006 | 10.5 | 10.5 | 238 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 5.4 | 17.7 | 17.7 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 4.9 | 9.6 | 9.6 | 0 |
| `POST /auth/login` | 1 | 200×1 | 90.3 | 90.3 | 90.3 | 90.3 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.2 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.1 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 18.7 | 18.7 | 18.7 | 18.7 | 0 |
| `GET /organizer/stats/live` | 13 | 200×13 | 5993.3 | 7189.8 | 7189.8 | 7189.8 | 0 |
| `GET /organizer/stats/process` | 13 | 200×13 | 5993.0 | 7187.9 | 7187.9 | 7187.9 | 0 |
| `POST /auth/login` | 300 | 200×300 | 10018.1 | 13602.7 | 14275.1 | 14585.9 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 4783.0 | 10810.3 | 13786.5 | 14295.5 | 0 |
| `POST /teams` | 100 | 201×100 | 131.8 | 233.7 | 252.4 | 252.6 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 224.1 | 291.1 | 300.6 | 309.1 | 0 |

### sse-idle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |

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
| setup | heartbeat | 75 | 0 | 0.00 / 0.01 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-idle | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

