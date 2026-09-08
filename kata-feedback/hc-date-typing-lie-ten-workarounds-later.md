# The `hc` date type-lie is now paid for in 6 files — and the workaround is unlintable

**Found while**: reviewing PR #140 (#54, organizer panel overview). Not a new
bug — a cost update on `hc-client-date-typed-as-date-but-wire-is-string.md`.
**Where in kata**: the `AppType`/`hc<AppType>` response-type inference for
`z.coerce.date()` output fields.

## What

The original entry (filed from #40) described the failure and proposed two
fixes. Neither has happened, which is fine — but the tax is worth quantifying
now that the front has grown, because it is no longer a one-screen curiosity.

Every consumer of a coerced-date field still has to re-wrap it by hand. As of
`develop` at 51780b3, `front/src` carries **10 such re-wraps across 9 lines in
6 files**, all of them working around this one inference gap:

| File | Lines |
|---|---|
| `front/src/routes/index.tsx` | 68, 203 |
| `front/src/routes/organizer.index.tsx` | 69, 211 |
| `front/src/routes/organizer.rounds.index.tsx` | 132, 312 |
| `front/src/routes/leaderboard.tsx` | 102 (twice on one line) |
| `front/src/routes/problem.$id.tsx` | 213 |
| `front/src/routes/rounds.$id.tsx` | 98 |

PR #140 alone added two of them, and the author knew: `organizer.index.tsx`
carries a comment pointing at the original feedback file. So the entry did its
job as tribal knowledge — the cost isn't that people get it wrong, it's that
every new screen touching a date pays a small tax that the type system claims
isn't there.

**The new observation is that this workaround cannot be linted for.** Because
the declared type is already `Date`:

- `new Date(x)` where `x` is genuinely a `Date` is a legal no-op, so the
  *correct* code and the *unnecessary* code are indistinguishable — a rule
  that flags redundant `new Date()` would produce false positives here, and
  one that requires it can't tell which values came from `hc`.
- The *missing* wrap is invisible in the other direction too: `closedAt.getTime()`
  typechecks cleanly and returns `NaN` at runtime. There is no signature, no
  squiggle, and no lint rule that separates the safe call from the broken one.

`leaderboard.tsx:102` shows the compounding version — `new Date(b.closedAt!)`
stacks the re-wrap on top of a non-null assertion, so two separate type
escapes sit on one expression, and neither is checkable.

## Why it matters

The original entry framed this as a footgun someone hits once. Six files later
it reads more like a standing convention the codebase maintains by hand, in
exchange for a type that is confidently wrong. That's the expensive shape:
not a crash, but a rule everyone must remember, that tooling cannot enforce,
and that gets silently more likely to be forgotten as the surface grows.

It also quietly weakens the repo's main safety claim. `AGENTS.md` sells the
typed RPC client as *the* front↔back contract — "change a schema in `back/`,
then run `pnpm -r typecheck` to surface front breakage". For date fields that
guarantee simply doesn't hold, and nothing at the call site says so.

## Metrics

- Occurrences: **10 re-wraps / 9 lines / 6 files** in `front/src` (excluding
  tests and bare `new Date()`), all attributable to this gap.
- Added by #140: 2, in a screen whose author had already read the filed entry.
- Cost per occurrence is small (one wrap) — the cost is cumulative and
  unenforceable, not per-site.
- kata-docs MCP queries during this review: **0** (consistent with the
  implementation side of #54 and with the #40 entry's own note — sibling
  modules keep winning over doc round-trips).

## Suggested fix (optional, unchanged in spirit)

Option (a) from the original entry — infer `string` for `z.coerce.date()`
fields in the *client response* type, since that is what `.json()` actually
yields — is the one that removes the tax instead of documenting it. It would
turn all 10 sites into compiler-guided changes rather than remembered ones,
and would make the missing-wrap case (`closedAt.getTime()`) a type error
instead of a runtime `NaN`.

If that inference change is too invasive, the next best thing is a named
helper exported from kata's client side (e.g. `wireDate(value)`) so the
workaround at least has a greppable identity — today it is spelled
`new Date(...)`, which is indistinguishable from ordinary date construction.
