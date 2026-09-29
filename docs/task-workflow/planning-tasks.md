# Planning a task

A plan turns an issue's Acceptance into numbered, verifiable steps. No code is
written here. Conventions in `docs/workflow.md`.

**Not for:** creating issues (creating tasks) or writing code (implementing a
task).

## Step 1 — Absorb

- **First, refresh the integration branch**: `git fetch origin` and compare
  `git log --oneline -1 origin/develop` with the checkout you are reading.
  Plan against `origin/develop`, never against a stale local `develop` —
  two plans (#229, #203) had to be rewritten in public because the code they
  described had already changed. If the main checkout is behind, read the
  files from the ref (`git show origin/develop:<path>`) or from a fresh
  worktree.
- `gh issue view <N> --comments` — body, acceptance, prior discussion.
- Read `docs/product.md` and `docs/tech-stack.md` for context; the package
  `AGENTS.md` (back/ or front/) for local rules.
- Explore the code the issue touches (routes, services, schemas, screens).
  Reading is fine anywhere, but the moment you need to RUN the app or try
  scratch code, do it in a worktree (`docs/workflow.md` § Worktrees) — the
  main checkout must never accumulate changes, planned or exploratory.
- kata questions (API shapes, middleware, DI, verify rules) → kata's docs,
  where `AGENTS.md` § Kata framework feedback says. Never guess a kata API
  shape.

## Step 2 — Resolve material ambiguities

Reuse decisions from the request, issue and prior discussion. Resolve routine
implementation details using repository conventions and code evidence. Ask
focused, batched questions when a missing product decision, constraint or
conflicting acceptance criterion materially changes the plan. Offer options and
a recommendation where useful; continue independent investigation while waiting.
State material assumptions in the plan, and do not repeat answered questions.

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

Show it to the user. Implementing a task may only start after the user
explicitly approves; revisions edit the same comment (`gh issue comment --edit-last`).

## Step 5 — Kata feedback

A `kata-feedback/` report or a `LEDGER.csv` line, per `AGENTS.md` § Kata
framework feedback.

## Step 6 — Handoff (MANDATORY)

The next step runs in a **fresh session**, so the very last thing you print is
a plain, ready-to-open line for that session:

```
Next: implement issue #12.
```

Substitute the real number. Say in one line above it that the plan must be
approved first (a comment on the issue, or restated at the top of the new
session) — the fresh session cannot see this session's approval. Never end
with a prose suggestion alone — end with the literal handoff line.
