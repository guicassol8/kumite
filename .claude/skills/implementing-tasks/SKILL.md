---
name: implementing-tasks
description: Implements an approved GitHub Issue plan on a task branch with TDD, runs every gate, and opens a PR linked to the issue. Triggers: "implementa a #N", "bora implementar", "codar a task", "faz a task", "implement #N", "work on #N", "build it".
---

# Implementing a task

Code an **approved plan** — nothing else. Conventions in @docs/workflow.md;
package rules in `back/AGENTS.md` / `front/AGENTS.md`.

**Not for:** unplanned work (run `planning-tasks` first), reviewing
(`reviewing-tasks`).

## Preconditions

- The issue has a `## Plan` comment the user approved. No plan → stop and run
  `planning-tasks`.
- **All work happens in a dedicated worktree — never in the main checkout**
  (other agents may be working here in parallel). In Claude Code prefer
  EnterWorktree; manual flow:

```bash
git fetch origin
git worktree add .worktrees/task-<N>-<slug> -b task/<N>-<slug> origin/develop
cd .worktrees/task-<N>-<slug>
pnpm install   # node_modules are per-worktree
```

- Running the app from the worktree while another instance is up? Override the
  ports (`PORT`, `--port`, `VITE_API_URL`) in this worktree's `.env` files.

## Loop — per plan step

1. **RED**: write or extend the test for the step first, watch it fail.
2. **GREEN**: implement the minimum that passes.
3. **Gates** (all from the root, in order):
   `pnpm format` → `pnpm -r typecheck` → `pnpm verify` → `pnpm -r test`.
4. Extra obligations by surface:
   - back route added/changed → update the module's `.hurl` and run it against
     a live server when feasible (`pnpm dev:back` + `pnpm --filter @kumite/back hurl`);
   - front UI → `data-testid` on new interactive elements + keys in the three
     i18n catalogs;
   - db change → `db/schema.ts` + `pnpm --filter @kumite/back db:generate`,
     commit the migration.
5. One conventional commit per coherent step (`feat: …`, `test: …`).

## House rules

- Doubt mid-flight → ASK the user (AskUserQuestion). Never guess.
- Discovered work → new issue via `creating-tasks` with "Discovered from #N";
  never expand the current scope.
- Hooks block? That's a real failure — fix the cause. Bypassing (`--no-verify`,
  `SKIP=`) is denied and prohibited.

## Finish — open the PR

```bash
git push -u origin task/<N>-<slug>
gh pr create --base develop --title "<issue title>" --body-file -
```

PR body: `Fixes #N`, a short what/how summary, the test plan, and an empty
`## Evidence` section — `reviewing-tasks` fills it. The task is **NOT** done at
PR creation.

After the PR merges, clean up:

```bash
git worktree remove .worktrees/task-<N>-<slug>
git branch -d task/<N>-<slug>
```

## Kata feedback (attempt every time)

This loop is the heaviest kata surface of the whole workflow — `kata verify`,
hurl, the DI/JWT/error idioms, maybe `kata-docs` lookups mid-flight. Before
the handoff, attempt a `kata-feedback/` entry: not gated on hitting a bug —
a clean run with nothing to report is still worth a line. Where you have
them, include metrics: turns or tokens spent chasing a kata-docs answer vs.
the task's total, any `kata verify`/hook friction, whether the harness
caught something real or just added ceremony. See `AGENTS.md` § Kata
framework feedback and `kata-feedback/README.md` for the format.

## Handoff (MANDATORY)

The review runs in a **fresh chat**, so the very last thing you print is the
command to paste there — alone in a fenced block, nothing after it:

```
/reviewing-tasks #34
```

That number is the **PR**, not the issue — print the PR number you just opened,
and its URL in the line above. Never end with "agora é só revisar" or a prose
suggestion — end with the command itself.
