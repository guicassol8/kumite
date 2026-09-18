# Implementing a task

Code an **approved plan** — nothing else. Conventions in `docs/workflow.md`;
package rules in `back/AGENTS.md` / `front/AGENTS.md`.

**Not for:** unplanned work (plan the task first), reviewing (reviewing a
task).

## Preconditions

- The issue has a `## Plan` comment the user approved. No plan → stop and
  plan the task first.
- **All work happens in a dedicated worktree — never in the main checkout**
  (other agents may be working here in parallel):

```bash
git fetch origin
git worktree add .worktrees/task-<N>-<slug> -b task/<N>-<slug> origin/develop
cd .worktrees/task-<N>-<slug>
pnpm install   # node_modules are per-worktree
```

- Running the app from the worktree while another instance is up? Override the
  ports (`PORT`, `--port`, `VITE_API_URL`) in this worktree's `.env` files.

## Loop — per plan step

1. **RED**: for behavior changes, write or extend a meaningful test first
   when practical and watch it fail. For documentation or other low-impact
   changes, use relevant validation instead of tests that mirror the edit.
2. **GREEN**: implement the minimum that passes.
3. **Verify the step** with focused tests or checks appropriate to the change.
   Before completion or opening/updating the PR, run formatting and the full
   gate ladder from the root: `pnpm format` → `pnpm -r typecheck` →
   `pnpm verify` → `pnpm -r test`. Successful hooks can satisfy the same
   checks for the same revision; do not repeat a passing suite unless later
   changes or failures justify it. See `docs/workflow.md`.
4. Extra obligations by surface:
   - back route added/changed → update the module's `.hurl` and run it against
     a live server when feasible (`pnpm dev:back` + `pnpm --filter @kumite/back hurl`);
   - front UI → `data-testid` on new interactive elements + keys in the three
     i18n catalogs;
   - db change → `db/schema.ts` + `pnpm --filter @kumite/back db:generate`,
     commit the migration; for any kata-side question it raises (DI, verify
     rules) read `~/Projetos/kata/docs` or the kata-docs MCP server when it
     is enabled — never guess.
5. One conventional commit per coherent step (`feat: …`, `test: …`).

## House rules

- Ask about missing product decisions or constraints that affect correctness
  or scope. Use repository evidence for routine implementation choices and
  preserve the user's earlier answers and authorization.
- Discovered work → new issue (see creating tasks) with "Discovered from #N";
  never expand the current scope.
- Hooks block? That's a real failure — fix the cause. Bypassing (`--no-verify`,
  `SKIP=`) is denied and prohibited.

## Finish — open the PR

```bash
git push -u origin task/<N>-<slug>
gh pr create --base develop --title "<issue title>" --body-file -
```

PR body: `Fixes #N`, a short what/how summary, the test plan, and an empty
`## Evidence` section — reviewing the task fills it. The task is **NOT** done
at PR creation.

After the PR merges, clean up from the main checkout — this removes every
worktree whose branch already landed on `origin/develop` and is clean, with
its throwaway Postgres:

```bash
pnpm worktree:prune          # --dry-run to list first
```

## Kata feedback (only when kata was in frame)

This loop is where kata shows up most — `kata verify`, hurl, the
DI/JWT/error idioms. Before the handoff: if kata was genuinely in frame and
you learned something or hit friction (a false positive, a rule that
blocked the plan, a hurl trap, a type that lied), write a `kata-feedback/`
entry with the metrics you have. If it was out of frame — a front-only or
docs-only task where verify merely ran green — append one line to
`kata-feedback/LEDGER.csv` and nothing else. Rule and format: `AGENTS.md`
§ Kata framework feedback, `kata-feedback/README.md`.

## Handoff (MANDATORY)

The review runs in a **fresh session**, so the very last thing you print is a
plain, ready-to-open line for that session:

```
Next: review PR #34 (fixes issue #12).
```

That number is the **PR**, not the issue — print the PR number you just
opened, and its URL in the line above. Never end with a prose suggestion
alone — end with the literal handoff line.
