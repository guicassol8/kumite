# kumite — task workflow

Tasks are **GitHub Issues** in this repo, driven by five steps:
creating tasks → picking the next task → planning a task → implementing a
task → reviewing a task. This file holds the mechanical conventions shared by
every step (labels, issue format, ready-work rules, worktrees, branches/PRs,
releases); the step-by-step process for each one is agent-agnostic prose in
`docs/task-workflow/`:

| Step | Doc |
|---|---|
| Creating tasks | `docs/task-workflow/creating-tasks.md` |
| Picking the next task | `docs/task-workflow/picking-next-task.md` |
| Planning a task | `docs/task-workflow/planning-tasks.md` |
| Implementing a task | `docs/task-workflow/implementing-tasks.md` |
| Reviewing a task | `docs/task-workflow/reviewing-tasks.md` |

Claude Code additionally wraps each step as a slash-command skill under
`.claude/skills/` that imports the doc above rather than duplicating it.

## One step, one session — the handoff

Each step is a fresh session: the state lives on the issue and the PR, not in
the conversation. So **every step ends by clearly stating the next step and
its issue/PR number**, in a form the next session can open with; Claude Code
additionally prints the literal slash command, alone in a fenced block, ready
to copy-paste into a new chat.

| Finished | Next step |
|---|---|
| creating tasks (one issue) | plan issue #N — `/planning-tasks #N` in Claude Code |
| creating tasks (backlog/epic) | pick the next task — `/picking-next-task` in Claude Code |
| picking the next task | plan issue #N — `/planning-tasks #N` in Claude Code |
| planning a task | implement issue #N — `/implementing-tasks #N` in Claude Code — only after the user approves the plan |
| implementing a task | review PR #PR (the **PR** number) — `/reviewing-tasks #PR` in Claude Code |
| reviewing a task (approved + merged) | pick the next task — `/picking-next-task` in Claude Code |
| reviewing a task (changes requested) | implement issue #N (back to the **issue** number) — `/implementing-tasks #N` in Claude Code |

Approval does not survive the session boundary: a plan approved in one session
must be approved on the issue (or restated in the new session) before
implementation starts.

## Labels

| Group | Labels | Meaning |
|---|---|---|
| Priority | `P0` `P1` `P2` `P3` `P4` | P0 = drop everything · P2 = default · P4 = someday |
| Stack | `stack:front` `stack:back` `stack:fullstack` `stack:infra` `stack:harness` | where the work happens |
| Type | `type:feature` `type:bug` `type:chore` `type:spike` | nature of the work |
| Structure | `epic` | umbrella issue that only tracks sub-issues |
| State | `blocked` | explicitly parked (independent of "Blocked by") |

Every non-epic issue carries exactly one priority, one type, and at least one stack label.

## Issue body format

```markdown
## Contexto
Why this exists, 2–5 lines. If it belongs to an epic: "Part of #E".
If found mid-task: "Discovered from #N".

## Spec
What must be true when this is done — concrete, testable statements.

## Acceptance
- WHEN <condition> THE SYSTEM SHALL <behavior>
- WHEN <error condition> THE SYSTEM SHALL <error behavior>

## Blocked by
- #12
(omit the section when nothing blocks)
```

Epics: body is Contexto + a task list (`- [ ] #N`) of sub-issues; no Acceptance
of their own.

## Ready work — how the next task is chosen

An issue is **READY** when: open · not `epic` · not `blocked` · every "Blocked
by" reference is closed · not already linked to an open PR.

Pick = READY ∩ highest priority, tie-broken by **unblocking value**: prefer
the issue that more open issues list under "Blocked by" — it clears the most
follow-on work. Among issues that unblock the same number of others, tie-break
by **isolation**: prefer the one whose scope (stack, modules, screens)
overlaps least with other open issues and in-progress work.

## Worktrees — one per task, always

The main checkout stays clean: **all task work happens in a dedicated git
worktree**, because more than one agent may be working on this repo at once.

```bash
git fetch origin
git worktree add .worktrees/task-<N>-<slug> -b task/<N>-<slug> origin/develop
cd .worktrees/task-<N>-<slug>
pnpm install        # node_modules are per-worktree, not shared
```

- `.worktrees/` is gitignored; never nest a worktree anywhere else.
- Reviewing a PR? Same rule: `git worktree add .worktrees/review-<PR> <pr-branch>`.
- Running the app in parallel worktrees: the default ports (3000 back,
  5173 front) collide — override with `PORT` / `--port` and `VITE_API_URL`
  in that worktree's `.env` files.
- Postgres collides too: the compose host port is fixed unless overridden.
  Copy `.env.example` to `.env` at that worktree's root and set `DB_PORT` to
  a free port (e.g. `DB_PORT=5439`), then `docker compose up -d` binds there
  instead of 5433. Each worktree is already its own compose project
  (directory-based), so its volume is separate and disposable on its own —
  point that worktree's `back/.env` `DATABASE_URL` at the same port
  (`postgres://kumite:kumite@localhost:5439/kumite`) and run
  `pnpm --filter @kumite/back db:migrate` (+ `db:seed` if needed).
- After the PR merges: `docker compose down -v` (if this worktree ran its own
  Postgres) before `git worktree remove .worktrees/task-<N>-<slug>` and
  delete the branch.
- In Claude Code, prefer the harness's managed isolation (EnterWorktree /
  subagent `isolation: "worktree"`) — it creates and cleans worktrees itself.

## Branches, commits, PRs

- `develop` is the integration branch — all task work is based on it, and
  every task PR targets it. `main` is the **release** branch: it only ever
  moves when the user explicitly asks for a merge (see § Releases below).
  Never commit directly on `main` or `develop`.
- Branch `task/<issue>-<slug>` off up-to-date `develop`, created with its
  worktree (above).
- Conventional commits on **every** commit: `feat:` `fix:` `chore:` `test:`
  `docs:` `refactor:`.
- Open the PR against `develop` explicitly: `gh pr create --base develop ...`.
- PR body starts with `Fixes #N` and ends with an `## Evidence` section.
- **Evidence is mandatory** (reviewing-tasks):
  - front → Playwright walkthrough screenshots committed under
    `front/e2e/evidence/<issue>/`, referenced step by step in the PR body;
  - back → trimmed `pnpm -r test` + `pnpm --filter @kumite/back hurl` output.
- GitHub only auto-closes a `Fixes #N` issue when the PR merges into the
  repo's **default branch**. Since PRs merge into `develop` (not default),
  `reviewing-tasks` closes the issue explicitly on merge instead of relying
  on that.

## Releases — merging `develop` into `main`

`main` is the release/production branch (it's also what Vercel deploys from).
It only advances when the user explicitly asks for a merge to `main` —
never as a side effect of a task PR landing on `develop`.

Every merge into `main` produces a new version, no exceptions:

1. `git fetch origin && git checkout main && git merge --ff-only origin/develop`
   (fast-forward; if it's not a fast-forward, resolve on `develop` first —
   `main` never gets its own merge commits).
2. Push `main`.
3. Tag the release: bump semver from the last tag (`git tag -l 'v*'`) —
   **patch** if the batch since the last release is fixes/chores only,
   **minor** if it includes any new feature. Pre-1.0, that's the whole
   scale in play; ask the user only if a batch is ambiguous enough to
   plausibly warrant more.
4. `gh release create vX.Y.Z --title "..." --notes "..."` summarizing what
   shipped since the previous tag (see the `v0.1.0` release for the shape).

## Discovered work

Mid-task discoveries never expand the current scope: open a new issue
("Discovered from #N") and keep the task on rails.
