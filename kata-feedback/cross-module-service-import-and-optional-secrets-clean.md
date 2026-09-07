# Cross-module service import and optional-secret DI, both friction-free

**Found while**: #52 (organizer user-management API: search/reset/promote/
deactivate, redesigned mid-task into an OTP email-confirmation flow with
real AWS SES wiring)
**Where in kata**: `defineRoute`/`defineContext` DI, `kata verify --strict-coverage`

## What

Two shapes this task needed that I expected might cause friction, neither did:

1. **A route in one module calling a service function from a different,
   unrelated module.** `users.route.ts`'s `reset-password` handler imports
   `issuePasswordResetOtp` directly from a new `password-reset` module
   (rather than adding a thin pass-through wrapper in `users.service.ts`).
   `kata verify --strict-coverage` never flagged this — it only cares about
   the DI/middleware chain reaching `c.get()`, not which module a plain
   function import comes from. Existing code already does this
   (`problems.service.ts` imports from `rounds.service`/`submissions.service`),
   so this wasn't a surprise once I'd read that file, but it's worth noting
   the framework has zero opinion here — module boundaries are a convention
   enforced by nothing but the folder-layout rule in `AGENTS.md`, not by kata.

2. **A service that needs a secret which may or may not be configured**
   (AWS SES creds — optional in dev/CI, required in prod). Nothing about
   `defineContext`/config assumes every env var is mandatory; making
   `AWS_REGION`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` all
   `z.string().optional()` in the existing `config.ts` `EnvSchema` pattern
   and branching inside the service function (real SES send vs.
   `console.log` fallback) required no framework accommodation at all — it's
   just plain Zod + a plain `if`. `kata verify` doesn't inspect service
   internals, so this was fully invisible to it either way.

## Why it matters

Both are "the framework got out of the way" reports, not bugs — useful
signal that kata's DI surface doesn't force artificial module wrappers or
mandatory-secret config shapes on a kumite consumer with a real optional-
integration need (SES here, but the same shape would apply to any
optional third-party call).

## Metrics

Zero `kata-docs` MCP queries this session — all kata-specific patterns
(route `output` status maps, `c.error`, `NoContentSchema` as `z.void()`,
`onConflictDoUpdate`, the 401/403 short-circuit-past-`output` note already
in `problems.route.ts`) were resolved by reading sibling modules
(`problems.*`, `teams.*`, `event-codes.*`) already in the repo, not by
querying kata-docs. This was a large task (14 commits, 3 new db objects,
5 modules touched, one full mid-flight redesign) where kata-docs would
have been a reasonable first stop for at least the DI/cross-module
question above — worth flagging that "grep the codebase for a precedent"
was faster and sufficient here, so the MCP server never got exercised
even though the task profile (AGENTS.md's own guidance) suggested it
would be relevant.
