/**
 * Numeric ceilings the API enforces, mirrored here so the organizer is told the
 * limit *before* a round-trip instead of after a rejected save (#187).
 *
 * These are copies, not imports: `front/` may not import from `back/` (only
 * `@kumite/blocks` is a sanctioned cross-package runtime dependency), and the
 * typed RPC client carries a schema's inferred *type*, never its refinements —
 * `.max()` leaves `number` as `number`, so no amount of `hc<AppType>` would
 * surface these. A drift is caught by tests: each constant is pinned to its
 * literal on both sides of the wire.
 */

/** Mirrors `PROBLEM_POINTS_MAX` in back/src/modules/problems/problems.schema.ts. */
export const POINTS_MAX = 10_000

/** Mirrors `EVENT_MAX_TEAM_SIZE` in back/src/modules/event-config/event-config.schema.ts. */
export const MAX_TEAM_SIZE_MAX = 10
