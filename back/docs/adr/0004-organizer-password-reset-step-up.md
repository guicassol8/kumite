# ADR-0004: Organizer password reset with step-up

- **Status:** Accepted
- **Date:** 2026-09-08
- **Deciders:** guicassol8 (product/eng), Claude (planning/implementation)

## Context

`POST /organizer/users/:id/reset-password` existed once and `#53` removed it,
for a good reason: as written, merely *issuing* an OTP wiped the target's
current password, so any organizer could lock any account out by mistake. That
particular bug is gone — since `#53` the password only changes when the OTP is
actually completed — but the route's removal left a real gap.

The event runs in person. A participant standing at the desk who cannot reach
their university mailbox (wrong phone, no signal in the lab, forgotten
webmail password) has no path back into their account: the self-service reset
of `#53` mails them a code they cannot read, and `#142` closed the last manual
workaround that still lived in documentation. Someone at the organizers' table
has to be able to hand them a working password on the spot.

Bringing the route back re-opens the question the removal never answered: an
organizer session is now a lever over every other account. If a laptop is left
unlocked in a room full of competitors — and it will be — a single unattended
browser tab is enough to take over accounts, including the other organizers'.

Forces in play: a two-day event, a handful of organizers who all share the
venue's NAT, a codebase where every route is a `defineRoute` with an explicit
`use:` chain, and `kata verify --strict-coverage` in pre-commit, which fails on
middleware chains it cannot resolve.

## Decision

We will bring the route back as an organizer-only action **gated by step-up
re-authentication**, handing out a one-time temporary password and forcing the
target to change it before they can use the API again.

Concretely:

- **Step-up.** The body carries `adminPassword`, verified with argon2 against
  the *acting organizer's own* hash before any effect. A hijacked session is
  not enough; the attacker also needs the password.
- **Temporary password.** 12 characters over `abcdefghjkmnpqrstuvwxyz23456789`
  in three hyphenated groups (`k7fq-3nrv-9wzt`). Returned exactly once, in the
  response, and never stored in plaintext. The alphabet drops `0 o 1 l i`
  because this password is read out loud across a desk. It does not expire —
  the forced-change block below is what limits its blast radius.
- **Participants only.** Never another organizer, never the caller themselves.
  A compromised organizer account must not be a lever for taking over the rest
  of the organizers. A *deactivated* participant is a valid target: login
  refuses inactive accounts regardless, so nothing is gained by excluding them.
- **Its own ceiling.** Five wrong admin passwords per organizer per
  `PASSWORD_RESET_WINDOW_MS`, reusing the `password_reset_requests` table under
  a new `organizer_reset` action. Over the ceiling the route answers the *same*
  403 as a wrong password — including burning an argon2 verify, so the blocked
  path does not answer faster and become a timing oracle of its own.
- **No email.** The entire premise is a participant who cannot read their
  inbox. Any pending OTP of theirs is deleted, so a code issued before the
  reset cannot be redeemed afterwards to overwrite the new password.
- **Forced change.** `users.must_change_password` is raised, and every
  authenticated route answers `403 password_change_required` until the target
  changes it via the new `POST /auth/change-password` — which always requires
  the current password, forced flow included, so the unlocked-laptop scenario
  is not simply moved one step down the line.

### Why `email_key` now holds an organizer id

The step-up ceiling is keyed by organizer id, not IP: the caller is already
authenticated, so the account is the thing worth protecting, and every
organizer at the venue shares one NAT anyway. Rather than a rename migration,
`password_reset_requests.email_key` is redefined as *the subject key of the
window* — an address for the two public actions, an organizer id for
`organizer_reset`. The column comment in `db/schema.ts` says so.

### Why the block is per-route middleware, not a wrapped `requireUser`

`requirePasswordUpToDate` is a `guard()` from `@katajs-framework/core/jwt`,
listed explicitly in the `use:` array of every authenticated route:

```ts
use: [requireUser, requirePasswordUpToDate, requireOrganizer]
```

This is the shape kata designed for authorization, and `kata verify` can follow
the chain and see what each link provides. Composing the two into one handler
by hand is exactly the case `--strict-coverage` flags as an unresolvable chain,
so the "obvious" DRY version would have to be argued past the very check that
keeps the middleware graph honest.

The cost is real and worth naming: **this fails open**. A new authenticated
route that forgets the middleware is simply unguarded, and nothing about the
type system or the linter will complain.

That cost is paid by a guardrail test in `src/auth-guards.test.ts`, which walks
every route registered in `app.ts` (hence `export const modules`) and fails,
naming the offending `METHOD /path`, when one uses `requireUser` without
`requirePasswordUpToDate`. The allowlist of intentional exemptions lives in
that test, and there are exactly two:

- `GET /me` — how the front *discovers* the flag; blocking it would leave the
  client unable to tell why everything else is failing.
- `POST /auth/change-password` — the way out. Guarded, the state would be
  inescapable.

## Alternatives considered

### Alternative A — Reuse the `#53` OTP flow, organizer-triggered

Have the organizer trigger an OTP and read it to the participant. Rejected: the
code is mailed to an inbox the participant cannot reach, which is the entire
problem, and the organizer never sees it.

### Alternative B — No step-up; organizer role is enough

Simplest possible route. Rejected: it makes an unattended organizer session a
full account-takeover tool at an event where laptops sit open in shared rooms,
and it hands lateral movement between organizers to anyone who gets one
session.

### Alternative C — Wrap `requireUser` so the block cannot be forgotten

Fold the check into the auth middleware, making it impossible to omit.
Rejected on the framework grounds above: it makes the chain unresolvable to
`kata verify --strict-coverage`, and it also removes any way to exempt the two
routes that *must* stay reachable. The guardrail test buys back the safety
without fighting the framework.

### Alternative D — Expire the temporary password after N minutes

Rejected as redundant: the account can do nothing but change its password while
the flag is up, so an old temporary password is not a standing capability. It
would also break the realistic case of a participant who is handed a password
and only gets back to a machine twenty minutes later.

### Alternative E — Revoke the target's existing JWT

There is no revocation list in this project and this task does not invent one.
In practice the forced-change block already delivers the effect: the old token
stays valid but every route it can reach answers 403, so the only thing it can
still do is change the password.

Still true after #174, which fixed the neighbouring case — deactivating an
account did nothing to sessions already issued. No revocation list was
invented there either: the `resolve` of `requireUser` already loaded the
user's row on every request, so it simply stopped accepting one with
`active: false`, and the 401 lands before any handler.

The two blocks are deliberately asymmetric. `mustChangePassword` answers 403
and leaves two doors open (`GET /me`, `POST /auth/change-password`) because
that state must be escapable — the account is legitimate, it just holds a
password an organizer dictated out loud. `active: false` answers 401 and drops
the session whole: a banned account gets no escape hatch, which is the point
of the ban. That also means a deactivated participant who was handed a
temporary password still cannot use it — the 401 of the `resolve` arrives
before the 403 of `password_change_required`. Organizer resets targeting a
deactivated participant remain valid, since the caller authenticating there is
the organizer, who is active.

## Consequences

### Positive

- The on-site case has a real answer that takes one organizer and no mailbox.
- Compromising an organizer *session* is no longer enough to take over
  accounts, and compromising an organizer *account* does not spread to the
  other organizers.
- The forced-change block neutralises stale tokens for a reset account without
  building a revocation mechanism.

### Negative / costs

- The middleware fails open for routes added later — see the guardrail test.
- The temporary password crosses the wire in a response body and is spoken out
  loud. Both are accepted: it is single-use in practice, and the alternative
  (a mailbox) is precisely what is unavailable.
- Nothing records *who* reset *whom*. `password_reset_requests` only logs
  failures; a real audit trail is its own issue.

### Follow-ups

- Audit log of organizer resets (separate issue).
- If a third bucket type is ever added to `password_reset_requests`, revisit
  the `email_key` name — three meanings is where the shortcut stops paying.
