# Planning a route *removal* needed zero kata-docs lookups

**Found while**: planning #53 (tela de usuários do Painel), which grew into a
fullstack task: delete `POST /organizer/users/:id/reset-password`, add a public
`POST /auth/request-password-reset`, and move a password invalidation between
two service functions.

**Where in kata**: `defineRoute` output surface, `createApp({ modules })`
registration, hurl.

## What

Plain observation, no bug. The whole back half of this plan was designed by
reading kumite's own `back/src/modules/**` and `back/AGENTS.md` — the
`kata-docs` MCP server was never queried, and nothing in the plan felt like a
guess afterwards. Three kata surfaces carried the design on their own:

- **Route removal is genuinely local.** `app.ts` registers modules as namespace
  imports (`modules: [..., users, passwordReset, ...]`), so deleting an exported
  `defineRoute` from `users.route.ts` is the entire removal — no registry entry,
  no barrel file, no DI token to unwire. The only follow-on edit is a schema
  (`NoContentSchema`) that becomes orphaned in `users.schema.ts`, and `tsc`
  finds that.
- **The public/authenticated distinction is one line.** Modelling the new
  `request-password-reset` route was just copying the existing
  `complete-password-reset` route, whose only differentiator is the absence of
  `use:`. The comment already in that file explains *why* it's public, so the
  new route's shape needed no doc.
- **`AppType` makes the front's exposure to this legible up front.** The plan
  could state confidently that `pnpm -r typecheck` is the gate proving the front
  picked up the new route and dropped the old one, without running anything.

One thing the docs would *not* have helped with, and that is worth naming: the
security bug the plan fixes (OTP issuance invalidating the password immediately,
which would let any anonymous caller lock out any account once the endpoint went
public) was only visible by reading the service body. No route-level contract
expresses it.

## Why it matters

Two of the last three kumite back tasks (`task-54`, `rounds-api`) also recorded
zero docs lookups. The pattern that keeps holding: once a repo has one worked
example per kata surface, kata's shapes are regular enough that the *next* task
copies the example instead of consulting docs. That's a compliment to the
framework's uniformity, but it also means kata-docs' measurable value in this
repo is now concentrated almost entirely in *first* encounters with a surface —
worth knowing if anyone is weighing what to invest in the docs.

## Metrics

- kata-docs MCP queries: **0**. Docs read: **0**.
- Planning cost: ~12 tool calls, all `cat`/`grep` over kumite's own source, plus
  3 rounds of AskUserQuestion. Roughly 45k tokens of context total, none of it
  kata-docs.
- Turns lost to a kata dead end: 0.
- `kata verify` was not run this session (planning writes no code).
- Did skipping the MCP cost anything? No visible gap — but this is a
  self-report, and a wrong assumption baked into a plan wouldn't surface until
  implementation. Flagging that as the honest limit of this data point.

## Suggested fix

None. Recording as signal, not as a problem.
