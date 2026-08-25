# kumite — product

Competitive block-programming platform for the online event between **PUCRS**
(Porto Alegre, Brazil) and **Universidad de Mérida** (Mexico).

## What it is

A problem appears on screen; participants solve it by dragging programming
blocks (Blockly-style visual editor). Submissions are sent to the server, which
executes them in a sandbox against test cases and scores automatically.

## How the competition works

- **Teams** of students. Cross-university teams (PUCRS + Mérida together) are
  allowed by default; a config flag can lock mixing later. Score is per team.
- **Live rounds**: an organizer opens a round, a timer runs, teams submit,
  a leaderboard updates in real time (SSE).
- **Auto-judge**: correctness is decided server-side against test cases —
  the client is never trusted with scoring.

## Who uses it

- **Participants** — students from both universities. Sign up with
  email+password plus an event code; join or create a team.
- **Organizers** — run the event: manage problems, open/close rounds,
  watch the leaderboard, moderate.

## Languages

PT (default), ES and EN are all first-class: UI strings live in three catalogs
and problem statements are authored in the three languages.

## Non-goals (for now)

- Native mobile app (the web front is responsive).
- Multiple simultaneous events / multi-tenancy.
- Public self-serve sign-up without an event code.
