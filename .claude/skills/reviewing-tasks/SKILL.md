---
name: reviewing-tasks
description: Reviews a task PR in two stages (spec compliance, then code quality) and produces the mandatory evidence — a Playwright visual walkthrough with screenshots for front work, test and hurl output for back work. Triggers: "revisa a #N", "revisar o PR", "faz o review", "gera as evidências", "review #N", "review the PR".
---

# Reviewing a task

A review is only done when compliance is checked, quality is checked, and
**evidence exists**. Conventions in @docs/workflow.md.

**Not for:** implementing fixes beyond review findings (loop back to
`implementing-tasks`).

## Stage 0 — Check out the PR in its own worktree

Reviews never run in the main checkout (other agents may be working there):

```bash
git fetch origin
git worktree add .worktrees/review-<PR> task/<N>-<slug>
cd .worktrees/review-<PR>
pnpm install
```

Everything below — reading, running the app, committing evidence — happens
inside this worktree. When the review ends (merged or handed back):
`git worktree remove .worktrees/review-<PR>`.

## Stage 1 — Spec compliance

- `gh pr view <PR> --comments` + `gh pr diff <PR>` + the linked issue.
- Walk the issue's Acceptance line by line and produce a table:
  `✅ met / ❌ not met / 🔲 can't verify from the diff`.
- Any ❌ → hand back to `implementing-tasks` with the exact gap. Do not
  continue to quality review on a non-compliant PR.

## Stage 2 — Quality

Review the diff only (not the whole repo) for:
- correctness and error paths;
- kata idioms in back (schemas in `.schema.ts`, `c.error(...)` for errors,
  services pure — `kata verify` catches most, look for what it can't);
- AI-regression smells: unrelated deletions, ghost imports, weakened
  assertions, swallowed errors, `any`;
- test quality (asserting behavior, not implementation) and i18n catalog parity.

## Stage 3 — Evidence (MANDATORY, blocking)

**Front-touching PRs — visual walkthrough** (all inside the review worktree):
1. Boot the stack (`docker compose up -d`; Playwright's webServer boots
   back + front on its own). If another instance is already running, override
   the ports in this worktree's `.env` files.
2. Drive every changed flow via a Playwright spec in `front/e2e/`
   (extend or add one), asserting through `data-testid`.
3. Screenshot each meaningful final state to
   `front/e2e/evidence/<issue>/<nn>-<state>.png` and commit them on the PR branch.
4. Write the walkthrough in the PR's `## Evidence`: step → expected → screenshot
   path, in order.

**Back-touching PRs:**
1. `pnpm -r test` — paste trimmed output.
2. Server up (`pnpm dev:back`) → `pnpm --filter @kumite/back hurl` — paste
   trimmed output.

No evidence = the review is NOT done. Say exactly that rather than approving.

## Verdict

- **Approve**: comment with the compliance table + evidence links, then merge
  only with the user's explicit go-ahead: `gh pr merge --squash --delete-branch`.
  The PR targets `develop`, not the repo's default branch, so `Fixes #N`
  does **not** auto-close the issue — close it explicitly:
  `gh issue close <N> --reason completed`.
- **Request changes**: precise, file-level items on the PR.

## Handoff (MANDATORY)

The next step runs in a **fresh chat**, so the very last thing you print is the
command to paste there — alone in a fenced block, nothing after it.

Approved and merged (the issue is closed; on to the next task):

```
/picking-next-task
```

Changes requested (the number is the **issue**, not the PR — the fix continues
that task):

```
/implementing-tasks #12
```

Still blocked on the user's go-ahead to merge? Say that in one line, and print
the `/picking-next-task` block anyway as the step after it. Never end with a
prose suggestion — end with the command itself.
