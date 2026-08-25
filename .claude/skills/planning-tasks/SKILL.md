---
name: planning-tasks
description: Produces a spec-driven implementation plan for a GitHub Issue, interrogating the user about every ambiguity, and posts it on the issue for approval before any code is written. Triggers: "planeja a task", "planejar a #N", "faz o plano", "plano da issue", "plan task", "plan #N", "how should we build".
---

# Planning a task

A plan turns an issue's Acceptance into numbered, verifiable steps. No code is
written here. Conventions in @docs/workflow.md.

**Not for:** creating issues (`creating-tasks`) or writing code
(`implementing-tasks`).

## Step 1 — Absorb

- `gh issue view <N> --comments` — body, acceptance, prior discussion.
- Read `docs/product.md` and `docs/tech-stack.md` for context; the package
  `AGENTS.md` (back/ or front/) for local rules.
- Explore the code the issue touches (routes, services, schemas, screens).
  Reading is fine anywhere, but the moment you need to RUN the app or try
  scratch code, do it in a worktree (`docs/workflow.md` § Worktrees) — the
  main checkout must never accumulate changes, planned or exploratory.
- kata questions (API shapes, middleware, DI, verify rules) → query the
  `kata-docs` MCP server before guessing.

## Step 2 — Interrogate the user (MANDATORY)

Same house rule as creating-tasks: every ambiguity — UX choice, edge case,
data shape, error behavior, naming, i18n copy — is a question for the user,
never a silent decision. Batch with AskUserQuestion, always offering options
and a recommendation. Keep asking until the plan has no guesses left.

## Step 3 — Write the plan

Numbered steps `T1..Tn`, each with:

- **Files**: exact paths to create/change.
- **Change**: one or two sentences of what happens there.
- **Verify**: the test written or command run that proves the step
  (tests-first whenever possible).

The plan must also account for, when applicable:
- back: `<domain>.schema.ts` changes, `db/schema.ts` + `drizzle-kit generate`
  migration, `.hurl` update, `kata verify` staying clean;
- front: i18n keys added to the three catalogs, `data-testid` on new
  interactive elements, which Playwright evidence review will capture;
- the typed contract: schema change in back → `pnpm -r typecheck` step for front.

Steps are small (one sitting each) and independently checkable.

## Step 4 — Approval gate

Post the plan as an issue comment under a `## Plan` heading:

```bash
gh issue comment <N> --body-file -
```

Show it to the user. `implementing-tasks` may only start after the user
explicitly approves; revisions edit the same comment (`gh issue comment --edit-last`).

## Step 5 — Handoff (MANDATORY)

The next step runs in a **fresh chat**, so the very last thing you print is the
command to paste there — alone in a fenced block, nothing after it:

```
/implementing-tasks #12
```

Substitute the real number. Say in one line above the block that the plan must
be approved first (a comment on the issue, or "aprovado" at the top of the new
chat) — the fresh session cannot see this conversation's approval. Never end
with a prose suggestion — end with the command itself.
