/**
 * Team-name normalization and display, mirrored from the back (#185).
 *
 * `normalizeTeamName` is a copy, not an import: `front/` may not import from
 * `back/` (only `@kumite/blocks` is a sanctioned cross-package runtime
 * dependency), and the typed RPC client carries a schema's inferred *type*,
 * never its refinements — `name` is `string` on both sides whatever the rule
 * is. Drift is caught by tests: `lib/team-name.test.ts` and
 * `back/src/modules/teams/teams.test.ts` run the same table of cases, the same
 * convention `lib/field-limits.ts` uses for the numeric ceilings.
 *
 * Mirrors `normalizeTeamName` in back/src/modules/teams/teams.service.ts.
 */
export function normalizeTeamName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * The label to render for a team, falling back when the stored name has no
 * visible characters (achado #10).
 *
 * Teams created before #185 could be stored as `"   "`, which rendered as an
 * empty cell on the listing, a nameless row on the leaderboard and — worst —
 * a moderation card with no title at all, leaving the organizer no way to tell
 * one blank team from another.
 *
 * `fallback` is a parameter rather than a fixed string because the moderation
 * screen needs a different one: it disambiguates with the team id, while the
 * leaderboard and the listings stay free of that technical noise.
 */
export function displayTeamName(name: string, fallback: string): string {
  return normalizeTeamName(name) === '' ? fallback : name
}
