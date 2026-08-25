# kumite — task workflow

Tasks are **GitHub Issues** in this repo, driven by the five skills in
`.claude/skills/`: creating-tasks → picking-next-task → planning-tasks →
implementing-tasks → reviewing-tasks.

## One step, one chat — the handoff

Each step is a fresh session: the state lives on the issue and the PR, not in
the conversation. So **every skill ends by printing the command for the next
step**, alone in a fenced block, ready to copy-paste into a new chat.

| Finished | Next command |
|---|---|
| creating-tasks (one issue) | `/planning-tasks #N` |
| creating-tasks (backlog/epic) | `/picking-next-task` |
| picking-next-task | `/planning-tasks #N` |
| planning-tasks | `/implementing-tasks #N` — only after the user approves the plan |
| implementing-tasks | `/reviewing-tasks #PR` — the **PR** number |
| reviewing-tasks (approved + merged) | `/picking-next-task` |
| reviewing-tasks (changes requested) | `/implementing-tasks #N` — back to the **issue** number |

Approval does not survive the chat boundary: a plan approved in one session must
be approved on the issue (or restated in the new chat) before implementation
starts.

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

Pick = READY ∩ highest priority, tie-broken by **isolation**: prefer the issue
whose scope (stack, modules, screens) overlaps least with other open issues and
in-progress work. Among equally isolated issues, prefer the one that unblocks
the most others.

## Worktrees — one per task, always

The main checkout stays clean: **all task work happens in a dedicated git
worktree**, because more than one agent may be working on this repo at once.

```bash
git fetch origin
git worktree add .worktrees/task-<N>-<slug> -b task/<N>-<slug> origin/main
cd .worktrees/task-<N>-<slug>
pnpm install        # node_modules are per-worktree, not shared
```

- `.worktrees/` is gitignored; never nest a worktree anywhere else.
- Reviewing a PR? Same rule: `git worktree add .worktrees/review-<PR> <pr-branch>`.
- Running the app in parallel worktrees: the default ports (3000 back,
  5173 front) collide — override with `PORT` / `--port` and `VITE_API_URL`
  in that worktree's `.env` files.
- After the PR merges: `git worktree remove .worktrees/task-<N>-<slug>` and
  delete the branch.
- In Claude Code, prefer the harness's managed isolation (EnterWorktree /
  subagent `isolation: "worktree"`) — it creates and cleans worktrees itself.

## Branches, commits, PRs

- Branch `task/<issue>-<slug>` off up-to-date `main`, created with its
  worktree (above). Never commit directly on `main`.
- Conventional commits on **every** commit: `feat:` `fix:` `chore:` `test:`
  `docs:` `refactor:`.
- PR body starts with `Fixes #N` and ends with an `## Evidence` section.
- **Evidence is mandatory** (reviewing-tasks):
  - front → Playwright walkthrough screenshots committed under
    `front/e2e/evidence/<issue>/`, referenced step by step in the PR body;
  - back → trimmed `pnpm -r test` + `pnpm --filter @kumite/back hurl` output.

## Discovered work

Mid-task discoveries never expand the current scope: open a new issue
("Discovered from #N") and keep the task on rails.
