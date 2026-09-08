# ADR-0003: Password-reset anti-abuse

- **Status:** Accepted
- **Date:** 2026-09-08
- **Deciders:** guicassol8 (product/eng), Claude (planning/implementation)

## Context

`#53` made `POST /auth/request-password-reset` public and anonymous: it takes
nothing but an email and always answers `204`, identically for a registered
address and an unregistered one, so that it cannot be used to enumerate who
has an account. `POST /auth/complete-password-reset` answers `400 invalid_otp`
just as uniformly.

Identical response bodies were only half the job. Two holes were left open,
and `#142` closes them:

1. **Nothing limited how often either route could be called.** A single client
   could request codes for one address forever — flooding a real person's
   inbox and rotating the code out from under them each time — or sweep a list
   of addresses to map the user base.
2. **The two paths still differed in cost.** A registered address paid an
   `argon2.hash` plus an SES send; an unregistered one returned as soon as the
   user lookup missed. The bodies matched, but the clock did not, so the
   oracle `#53` closed on content was still open on timing.

The forces: this is an event app running for a few days with hundreds of
users, behind a single Caddy `reverse_proxy` on one VPS (ADR-0002). Whatever
we build has to be simple enough to reason about during the event, and must
not introduce a way for a third party to lock a legitimate participant out of
their own account recovery.

## Decision

We will throttle both routes with a **sliding window backed by Postgres**, and
equalize the work done on every path so the response time does not separate
them.

**The numbers** (`config.ts`, env vars with defaults, following
`SUBMISSION_COOLDOWN_MS`):

| Setting | Default | Meaning |
|---|---|---|
| `PASSWORD_RESET_WINDOW_MS` | `900000` (15 min) | the window, shared by both routes |
| `PASSWORD_RESET_MAX_PER_EMAIL` | `3` | requests for one address, `request` only |
| `PASSWORD_RESET_MAX_PER_IP` | `20` | requests from one client on `request` |
| `PASSWORD_RESET_COMPLETE_MAX_PER_IP` | `30` | requests from one client on `complete` |

**The state** is an append-only log, `password_reset_requests` (`action`,
`email_key`, `ip`, `created_at`), one row per *accepted* attempt. It has no FK
to `users` on purpose: the rows that matter most are the ones for addresses
that do not exist, since those are exactly what an enumeration sweep produces.
Expired rows are deleted opportunistically at the start of the next call, so
no separate timer or cron has to exist.

**Refused attempts do not count.** The window always drains 15 minutes after
the last attempt that got *through*. Counting refusals would mean anyone who
keeps hammering the route holds the address locked out indefinitely — the
throttle would become the denial-of-service it exists to prevent.

**Counting and inserting are one critical section**, guarded by a
transaction-scoped Postgres advisory lock per bucket (`pg_advisory_xact_lock`
on the hashed `action:email_key`, then on `action:ip`). Read-then-write across
separate statements is not a throttle: every call of a parallel burst reads the
same count before any of them has inserted, and the ceiling is then bypassed by
firing the requests at once instead of in sequence. Measured on this route
before the lock: 25 simultaneous requests for one address issued **10** codes
and sent **10** notices against a ceiling of 3. The locks are advisory, so they
cost nothing to unrelated traffic — only two callers aimed at the same address
or the same IP ever wait on each other — and they are taken in a fixed order
(`request` takes the address lock before the IP one, `complete` takes only the
IP one), so two waiters can never cycle into a deadlock. The opportunistic
purge stays *outside* the critical section: the counts filter on the window
themselves, so it only reclaims space, and it scans every bucket's rows rather
than just the caller's.

**The client IP is the rightmost `X-Forwarded-For` entry** (`lib/client-ip.ts`),
falling back to the socket address. Caddy appends the peer it actually saw to
whatever header arrived; the leftmost entry, which most examples reach for, is
written by the client. Reading it would let anyone mint a fresh per-IP bucket
per request, and nothing would fail loudly — the limiter would simply never
fire.

**Going over the ceiling changes nothing about the response.** `request` still
answers `204`, `complete` still answers `400 invalid_otp`. A `429` would
reintroduce the oracle from the other side: throttling that fires only for
registered addresses tells the caller which addresses are registered.

**Cost is equalized with dummy argon2 work.** On `request`, an unknown address
and a throttled one each pay one `argon2.hash`, matching the hash a real
issue performs — the same remedy as `DUMMY_PASSWORD_HASH` in `login`
(`auth.service.ts`). On `complete`, a missing user, a missing OTP, an expired
OTP and a throttled call each pay one `argon2.verify` against a fixed
`DUMMY_OTP_HASH`. Additionally, the SES send moved off the response path
(`void … .catch(…)`): awaiting it would put mail-provider latency only on the
path where an account exists.

Measured after the change, on the same machine:
`registered ≈ 65 ms · unregistered ≈ 61 ms · throttled ≈ 57 ms`.

`complete` deliberately has **no per-address ceiling**, only a per-IP one. The
OTP row already caps guessing at 5 attempts; a second per-address ceiling
would let a third party spend a legitimate owner's budget and block them from
finishing their own reset. For the same reason, the quota is consumed *before*
the OTP row is read, so a throttled call never decrements `attemptsRemaining`.

## Alternatives considered

### Alternative E — Leave the check-then-insert unsynchronised

Rejected once measured. The window is wide (15 min) and the ceilings are small,
so an approximate limiter sounded acceptable — but the overshoot is not a
rounding error: it is the whole mailbox-bombing protection, defeated by adding
`&` to a shell loop. A single `pg_advisory_xact_lock` per bucket closes it
without a schema change, a retry loop, or `SERIALIZABLE`.


### Alternative A — In-process `Map`, like `acquireSubmissionSlot` (#21)

Cheapest to write, no migration. Rejected: the reset routes are the ones an
attacker actually targets, and a process-local counter resets on every deploy
or restart — during an event that is a routine occurrence, not an edge case.
Postgres is already a hard dependency and the table is tiny.

### Alternative B — Answer `429` when the ceiling is hit

The honest HTTP answer, and better DX for a legitimate user who forgot they
had already asked. Rejected because the ceilings are per-address: a `429`
would fire on registered addresses in cases where an unregistered one still
answers `204`, which is precisely the account-existence oracle `#53` closed.

### Alternative C — Resend the same pending code instead of rotating it

Would remove the "a stranger rotated my code mid-typing" annoyance entirely.
Rejected: the OTP is stored only as an argon2 hash, so resending it would mean
keeping the plaintext code in the database — a strictly worse trade than the
annoyance it fixes. The `3`-per-address ceiling bounds how often the rotation
can happen anyway.

### Alternative D — Rate limit at the edge, in Caddy

Keeps the concern out of the app. Rejected: Caddy can throttle by IP but not
by *request body*, and the per-address ceiling is the half that protects a
real person's inbox. Edge limiting can still be added later on top of this.

## Consequences

### Positive

- Both acceptance holes from `#142` are closed without changing a single
  response shape, so `front/` needs no change and the typed RPC contract is
  untouched.
- The throttle state survives restarts and deploys.
- `lib/client-ip.ts` now exists for any future route that needs a caller
  address (audit logging, abuse triage).

### Negative / costs

- Every call to either route now costs an `argon2` operation, including the
  ones that do nothing. That is the point, but it does mean the routes are
  cheap to make expensive: a sweep still burns ~65 ms of CPU per request until
  the per-IP ceiling stops it at 20.
- Everyone behind one NAT — a lab room, a university network — shares a per-IP
  bucket. `20` per 15 minutes was picked to be far above what an honest room
  full of participants would produce, but it is not unlimited.
- A legitimate user who genuinely needs a 4th code within 15 minutes is stuck
  until the window drains, and the route cannot tell them so.

### Escape hatch (manual, until #143)

There is no self-service way to lift a lock, and by design no way for the
route to say it is locked. An organizer can clear it directly:

```sql
DELETE FROM password_reset_requests WHERE email_key = 'someone@edu.pucrs.br';
```

(or the equivalent in `pnpm db:studio`). The person can then request a code
immediately. Deleting only their rows leaves everyone else's budget intact.

### Follow-ups

- `#143` — organizer-driven reset (a single-use temporary password, step-up
  authenticated with the admin's own password), which replaces this manual SQL
  with a real screen. Blocked by this ADR's work.
- If the event ever runs behind more than one proxy hop, `clientIp` needs to
  count more than one entry from the right; today it assumes exactly one
  trusted proxy (Caddy).
