import { createHash } from 'node:crypto'

import { EventRankingSchema, RoundRankingSchema } from '../modules/ranking/ranking.schema'

// One fingerprint per ranking snapshot (#138): what an SSE connection last
// received must be what every other connection received, and what the API
// returns. Both sides go through the same ranking schemas first (zod drops
// what they do not declare: `serverTime`, `type`), then a canonical JSON with
// sorted keys, then sha256.

/** JSON with the keys of every object sorted, arrays kept in order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => {
    if (inner === null || typeof inner !== 'object' || Array.isArray(inner)) return inner
    return Object.fromEntries(
      Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
    )
  })
}

const SnapshotSchema = {
  round: RoundRankingSchema.nullable(),
  event: EventRankingSchema,
}

/**
 * sha256 of `{ round, event }` — a `ranking.updated` payload, or the pair
 * `GET /rounds/:id/ranking` + `GET /ranking`. Throws if either part does not
 * match its schema.
 */
export function rankingDigest(snapshot: { round: unknown; event: unknown }): string {
  const normalized = {
    round: SnapshotSchema.round.parse(snapshot.round),
    event: SnapshotSchema.event.parse(snapshot.event),
  }
  return createHash('sha256').update(canonicalJson(normalized)).digest('hex')
}
