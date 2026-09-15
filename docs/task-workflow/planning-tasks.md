# Planning a task

A plan turns an issue's Acceptance into numbered, verifiable steps. No code is
written here. Conventions in `docs/workflow.md`.

**Not for:** creating issues (creating tasks) or writing code (implementing a
task).

## Step 1 — Absorb

- `gh issue view <N> --comments` — body, acceptance, prior discussion.
- Read `docs/product.md` and `docs/tech-stack.md` for context; the package
  `AGENTS.md` (back/ or front/) for local rules.
- Explore the code the issue touches (routes, services, schemas, screens).
  Reading is fine anywhere, but the moment you need to RUN the app or try
  scratch code, do it in a worktree (`docs/workflow.md` § Worktrees) — the
  main checkout must never accumulate changes, planned or exploratory.
- kata questions (API shapes, middleware, DI, verify rules) → consult the
  kata-docs MCP server (this repo configures one in `.mcp.json`) before
  guessing; if it's unavailable or the call fails, read kata's own
  docs/source under `~/Projetos/kata` directly instead.

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

## Step 5 — Kata feedback (attempt every time)

If Step 1 queried the kata-docs MCP server, attempt a `kata-feedback/`
entry before moving on — not gated on finding a bug. Note whether the docs
actually answered the question or you ended up guessing anyway, and the
rough cost (queries made, docs read) versus the time it saved. See
`AGENTS.md` § Kata framework feedback and `kata-feedback/README.md` for the
format. Skip if this plan never touched kata.

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
