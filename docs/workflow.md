# kumite — task workflow

Tasks are **GitHub Issues** in this repo, driven by five steps:
creating tasks → picking the next task → planning a task → implementing a
task → reviewing a task. This file holds the mechanical conventions shared by
every step (labels, issue format, ready-work rules, worktrees, branches/PRs,
releases); the step-by-step process for each one is in
`docs/task-workflow/`:

| Step | Doc |
|---|---|
| Creating tasks | `docs/task-workflow/creating-tasks.md` |
| Picking the next task | `docs/task-workflow/picking-next-task.md` |
| Planning a task | `docs/task-workflow/planning-tasks.md` |
| Implementing a task | `docs/task-workflow/implementing-tasks.md` |
| Reviewing a task | `docs/task-workflow/reviewing-tasks.md` |

Claude Code runs each step through its skill under `.claude/skills/`
(`/creating-tasks`, `/picking-next-task`, `/planning-tasks #N`,
`/implementing-tasks #N`, `/reviewing-tasks #PR`), a thin wrapper that
imports the doc above.

Running several issues in one sitting is **batch mode**
(`docs/task-workflow/orchestrating-batch.md`): one thin session that only
decides and relays, delegating every step to a subagent — see below.

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

**The one exception — batch mode.** What this rule protects is *context
isolation*: no step may inherit the working context of the step before it.
`docs/task-workflow/orchestrating-batch.md` takes 1–3 issues from picking to
merge in a single session by moving that boundary from the session to the
subagent — planning, implementation and review each run in an agent spawned
fresh for them and discarded after, while the orchestrating session holds
only the batch state, the user's decisions and the relay. It never plans,
codes or reviews itself. Picking is the one step it keeps: selecting the
batch *is* the state it carries, and it writes nothing before the user
confirms. Anything that runs a planning, coding or review step in the shared
orchestrating context is a violation of this rule, not an instance of the
exception.

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
pnpm worktree:env   # its own database and ports (below) — when it runs the app
```

- `.worktrees/` is gitignored; never nest a worktree anywhere else.
- Reviewing a PR? Inspect `git worktree list --porcelain` first. Reuse the
  branch's dedicated worktree if clean and idle; otherwise coordinate ownership.
  Create `.worktrees/review-<PR>` only when the branch is not checked out
  elsewhere. See `docs/task-workflow/reviewing-tasks.md` § Stage 0.
- **Its own database and ports: `pnpm worktree:env`** (#404), once, right
  after `pnpm install`. On the shared native Postgres (no Docker) it gives the
  worktree a database of its own — `kumite_task<N>` on a `task/<N>-…`
  branch, `kumite_review<PR>` in `.worktrees/review-<PR>` — plus a back port
  3xxx and a front port 5xxx from the same number (skipping any port that is
  listening or already named by another tree's `back/.env`), writes
  `back/.env` (the main checkout's, with `DATABASE_URL`, `PORT`,
  `APP_BASE_URL` and `FRONT_PORT` replaced) and `front/.env`
  (`VITE_API_URL`), and runs `db:create` + `db:migrate` + `db:seed`. Re-running
  keeps the same database and ports and only migrates; `--reset` re-seeds
  (`db:reset`) — do that before a full E2E or hurl run. The shell's exported
  `PORT`, `DATABASE_URL` and `APP_BASE_URL` never leak in.
  - E2E: `pnpm e2e [playwright args]` (`CI=1 pnpm e2e` for the CI settings)
    runs Playwright with this tree's `back/.env` exported over the shell,
    `FRONT_PORT`, `VITE_API_URL` and a `BACK_NOTIFICATIONS_LOG`, so the
    organizer and real-OTP specs run instead of skipping.
  - Anything else with this tree's env (dev server, hurl):
    `eval "$(bash scripts/worktree-env.sh --print)"` in your shell, then
    `pnpm dev:back`, or `HURL_HOST=http://localhost:$PORT pnpm --filter
    @kumite/back hurl`.
  - **The E2E semaphore.** Every full E2E holds Chromium workers, a Vite and
    a back. `pnpm e2e` takes one of `KUMITE_E2E_SLOTS` slots (default: one
    per 5 GB of the machine's RAM, at least one — `flock` locks in
    `$TMPDIR`); a run that finds them all busy waits and says so.
  - The back test suite isolates itself anyway (#392): `pnpm test` runs
    against its own `<db>_test_<worktree dir>` (`<db>_test` in the main
    checkout and CI; `TEST_DATABASE_URL` overrides), created and migrated by
    its vitest globalSetup, so no ladder truncates an E2E's seed.

  With Docker (cloud sessions, a machine that has it): set `DB_PORT` to a
  free port in a root `.env` copied from `.env.example`, `docker compose up
  -d` binds there instead of 5433 in the worktree's own compose project,
  and `back/.env` `DATABASE_URL` points at that port — then `db:migrate`
  (+ `db:seed`).
- After the PR merges: `pnpm worktree:prune` from the main checkout. It
  removes every worktree whose branch is already in `origin/develop` and
  whose tree is clean, together with that worktree's compose project and
  `docker run` Postgres, and its databases on the local Postgres — its
  `<db>_test_<dir>` and the one `worktree:env` gave it (#395); never the
  main checkout's (`--dry-run` lists first). Dirty trees and unmerged
  branches are always kept — they may be another agent's.
- Playwright writes every spec's screenshots to `front/e2e/evidence/<n>/`,
  which git ignores (#402): a run never leaves changes behind, and the
  review attaches its own issue's folder to the PR instead of committing it.
- In Claude Code, prefer the harness's managed isolation (EnterWorktree /
  subagent `isolation: "worktree"`) — it creates and cleans worktrees itself.

## Gate ladder — before opening or updating a PR

Every task PR must pass the same three commands, in this order, from the
repo root:

1. `pnpm -r typecheck`
2. `pnpm verify` (`kata verify --strict-coverage` on `back/`)
3. `pnpm -r test`

This is a contract, not tooling trivia: a task is **not ready for PR or
review** while any of the three fails — no exceptions for "it's probably
fine" or "just docs nearby."

- **Where each step runs.**
  - The pre-commit (`lefthook.yml`) runs format, typecheck and `kata verify`
    on every commit — fast, and none of them needs a database. The test
    suites left it in #288, when two suites truncating the same local
    Postgres caused OOM-killed commits and phantom failures.
  - The **pre-push** (`lefthook.yml` → `scripts/pre-push-ladder.sh`) runs the
    whole ladder before anything reaches the remote, whenever the push
    carries changes under `back/`, `front/`, `blocks/` or `package.json`
    (#399). It is the one local gate every agent and every mode goes
    through — subagents included, which never fire the Stop hook. A
    docs-only push skips it. `bash scripts/pre-push-ladder-smoke.sh`
    proves which pushes it gates, with a throwaway repo and a stub `pnpm`.
  - Claude Code's **Stop hook** (`.claude/hooks/stop.sh`) runs the ladder
    when the session's tree has uncommitted code changes, and blocks the
    session from ending while it is red — up to 3 times in a row, then it
    lets the session stop with a warning, and the pre-push still refuses
    the code (#399).
  - CI's `check` job runs format, typecheck, verify and tests on every PR
    push (below).
  - The back suite truncates only its own derived database
    (`<db>_test[_<worktree dir>]`, § Worktrees), never the one the E2E,
    hurl or a dev server uses (#392).
- **Pushing.** With code in it, `git push` takes a few minutes: run it in the
  foreground with a 10-minute timeout (Bash `timeout: 600000` in Claude
  Code), never in the background. A refused push is a real failure — fix
  it and push again; `--no-verify` is denied. The full log of the last run
  is in `/tmp/kumite-pre-push-<tree dir>.log`.
- **During implementation** run focused tests for what you are changing;
  the full ladder by hand is redundant with the pre-push, unless you want
  the answer before committing. By hand,
  `bash scripts/pre-push-ladder.sh </dev/null` runs exactly what the
  pre-push runs. Through lefthook it is `pnpm exec lefthook run pre-push
  </dev/null` — without the `</dev/null`, lefthook hands the job a pipe
  from your terminal and it waits for Ctrl-D.
- **What CI runs, and when (#378).** Actions minutes on this private repo
  are metered, and a PR push used to cost ~17 of them, most of it
  re-running what the hooks already ran. So a PR push runs **one** job,
  `check`: `pnpm format:check` → `pnpm -r typecheck` → `pnpm verify` →
  `pnpm -r test`, the safety net for an agent that skipped the hooks. A PR
  that only touches Markdown or `kata-feedback/` runs nothing. `hurl` and
  `e2e` run on push to `main` (the Deploy workflow waits for CI there) and
  on demand, on any branch: `gh workflow run CI --ref <branch>`. On a PR
  their evidence comes from the reviewer's local runs (`reviewing-tasks.md`).
  To put one back on every PR push, delete its `if:` line in `ci.yml`. The
  whole workflow can also be switched off (`gh workflow disable CI`) when
  the month's minutes run out; `gh workflow list` shows which state it is
  in, and with it off nothing deploys.
- **Spend few CI minutes.** A branch without a PR runs no CI, so push it as
  often as you need before `gh pr create`. Once the PR is open, every push
  is a `check` run: batch the review's fixes into one push, and never
  `gh workflow run` unless the user asks.
- **When `check` did not run.** Out of Actions minutes, GitHub marks the job
  failed without starting it ("The job was not started because…"). That is
  not a green CI: before the merge, the review's Evidence carries the full
  local ladder (`pnpm -r typecheck`, `pnpm verify`, `pnpm -r test`) run on
  the PR's head, and says that `check` did not run (`reviewing-tasks.md`
  § Verdict).
- **E2E in CI.** The `e2e` job in `ci.yml` runs the **whole** Playwright
  suite (`pnpm --filter @kumite/front e2e`) on push to `main` and on manual
  dispatch. It has its own Postgres, the same throwaway organizer as
  the `hurl` job and a `BACK_NOTIFICATIONS_LOG` path, so the organizer and
  real-OTP specs run instead of skipping. It needs no secret. In CI only
  (`front/playwright.config.ts`), a failing spec gets one retry: one that
  passes on the retry is reported as **flaky** in the report and in the PR
  annotations, but it does not fail the job. `forbidOnly` is on, so a
  stray `test.only` fails the job instead of shrinking it. The HTML report,
  the traces and screenshots of failures and the back's log are uploaded as
  the `playwright-report` artifact (kept 14 days) whenever the job was not
  cancelled. The suite does not run in the pre-commit, the pre-push or the
  Stop hook, nor on a PR push. So "existing e2e green" on a PR means the reviewer ran
  the **whole** suite locally (`CI=1` for the CI settings) on the PR's head
  and it passed, or dispatched the `e2e` job on the branch and it is green —
  either way, name any flaky spec in the Evidence: the retry keeps a flake
  from failing the gate, it does not fix it (open an issue for it). `CI=1` reproduces the CI settings locally. Editor specs
  wait for Blockly through `expectBlocklyInjected`
  (`front/e2e/support/blockly.ts`), which carries the injection budget and
  checks the test's own (#246).

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
- Before opening or updating the PR, the gate ladder above must be green —
  the pre-push enforces it.
- PR body starts with `Fixes #N` and ends with an `## Evidence` section.
- **Evidence is mandatory** (reviewing-tasks):
  - front → a Playwright walkthrough: screenshots written to the git-ignored
    `front/e2e/evidence/<issue>/` and attached step by step to a PR comment
    with `gh pr comment --attach`, linked from the PR body (#402). Evidence
    PNGs are never committed; the ones from before #402 stay in history;
  - back → trimmed `pnpm -r test` + `pnpm --filter @kumite/back hurl` output.
- `develop` is also the repo's **default branch** on GitHub (#400), so:
  `Fixes #N` closes the issue when the PR merges; the worktrees Claude Code
  creates (`EnterWorktree`, `isolation: "worktree"`) start from
  `origin/develop`; and `gh pr create` targets it. `main` keeps triggering
  CI and Deploy on push, and Vercel's production branch stays `main`. One
  catch: Deploy is a `workflow_run` workflow, and GitHub always runs those
  from the default branch's copy of the file — so a change to
  `.github/workflows/deploy.yml` applies to the next deploy of `main` as
  soon as it merges into `develop`, not at the release (the code it builds
  and ships is still `main`'s commit). A clone made before the switch needs
  `git remote set-head origin --auto` once, or its `origin/HEAD` keeps
  saying `main`.

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
