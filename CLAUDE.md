# CLAUDE.md

See @AGENTS.md for the canonical instructions.

## Clarification

Reuse the user's prior answers and authorization. Ask focused questions
(AskUserQuestion, batched, with options where useful) for missing product
decisions or constraints that materially affect the task. Resolve routine
implementation details from repository conventions and code evidence; state
material assumptions. A complete request does not need another question round.

## Skills

These are Claude Code's slash-command shortcut over the agent-agnostic
process in `docs/task-workflow/` (see `AGENTS.md` § Map) — use them when
running inside Claude Code; the docs are the source of truth.

| Skill | Use when |
|---|---|
| creating-tasks | turning ideas/specs into GitHub Issues |
| picking-next-task | choosing what to work on next |
| planning-tasks | designing the implementation of an issue |
| implementing-tasks | coding an approved plan |
| reviewing-tasks | reviewing a PR + producing mandatory evidence |
| orchestrating-batch | running 2–3 issues end to end via subagents |

Each step is its own chat: every skill ends by printing the next step's command,
ready to paste into a new session. The full chain is in `docs/workflow.md`
§ One step, one session.

`orchestrating-batch` is the deliberate exception: it runs the whole chain in
one chat, delegating planning, implementation and review to a fresh-context
subagent each instead of to a new chat. Same isolation, different boundary —
`docs/workflow.md` § One step, one session.

## Claude-specific notes

- The `kata-docs` MCP server (`.mcp.json`) is optional — it may be disabled
  in `settings.local.json`. When it is available, prefer it for kata API
  questions; when it is not, read `~/Projetos/kata/docs` and the bundled
  `.d.ts` directly, and do not report its absence.
- Kata feedback: a report in `kata-feedback/` only when kata was genuinely
  in frame or caused friction; otherwise one line in `kata-feedback/LEDGER.csv`.
  See `AGENTS.md` § Kata framework feedback. Never fix kata itself as a side
  effect of a kumite task.
- Hooks: PostToolUse auto-formats and runs `kata verify` on back edits. Stop
  runs the full gate ladder (typecheck → verify → tests) when the session's
  tree has uncommitted code changes, and blocks up to 3 times in a row while
  it is red — then it lets the agent stop, with a warning (#399). The
  pre-commit (lefthook) runs format, typecheck and verify; the pre-push runs
  the full ladder whenever the push carries code (#399). The pre-push is the
  one local gate every agent hits, subagents included — so `git push` takes a
  few minutes: run it in the foreground with a 10-minute Bash timeout. In cloud
  sessions only, SessionStart prepares everything (Docker + Postgres,
  install, `.env` files, migrate, seed) and exports `JWT_SECRET`, the CI
  organizer and `BACK_NOTIFICATIONS_LOG`, so the full E2E runs with nothing
  skipped, worktrees included (#333).
- Hooks in a worktree (#286): `$CLAUDE_PROJECT_DIR` is always the main
  checkout, and it is the main checkout's copy of the hooks that runs — a
  hook change only takes effect there after it merges and is pulled. So the
  hooks never trust their own path: Stop gates the git toplevel of the
  payload's `cwd`, PostToolUse the toplevel of the edited file (either one
  only if it is a worktree of this repo; otherwise the main checkout, as
  before). The ladder uses that tree's `back/.env` `DATABASE_URL`, else the
  shared 5433 default — as the base only: the back tests derive their own
  `<db>_test_<worktree dir>` (`<db>_test` in the main checkout) from it and
  truncate that, so a Stop that fires mid-E2E or mid-hurl in the same tree
  no longer wipes their seed (#392); the ladder itself is unchanged.
  Isolating the E2E's own database without Docker: `docs/workflow.md`
  § Worktrees. Stop blocks (up to 3 times in a row, like any red step) until
  the worktree has run `pnpm install`.
  Each Stop run appends one line (root, DB source, decision — never the URL)
  to `/tmp/kumite-stop-hook.log`: look there first on an `exit 143`.
  `bash scripts/claude-hooks-smoke.sh` proves the behavior with throwaway
  worktrees and a stub `pnpm`. Subagents with `isolation: "worktree"` fire
  `SubagentStop`, not `Stop`, so the Stop ladder does not gate their
  worktree — the pre-push does (#399), and CI after it.
- Worktrees: prefer the harness's own isolation — `EnterWorktree` for this
  session's task work, `isolation: "worktree"` when spawning subagents that
  edit files. Both start from `origin/develop`, the default branch (#400);
  rename the branch to `task/<N>-<slug>`. Manual fallback:
  `git fetch origin && git worktree add .worktrees/task-<N>-<slug> -b task/<N>-<slug> origin/develop`
  then `pnpm install` inside it (node_modules are not shared).
