/** Leaf reported when nothing under the root route matched the URL. */
const NOT_FOUND = '/404'

type PatternMatch = { routeId: string; fullPath: string }

function normalizeSegment(segment: string): string {
  if (segment === '$') return '[...splat]'
  if (segment.startsWith('$')) return `[${segment.slice(1)}]`
  return segment
}

/**
 * The analytics path for the current router state: the *pattern* of the deepest
 * match, never the URL the user is on. `/problem/$id` becomes `/problem/[id]`,
 * so no problem or round id ever leaves the browser and the Vercel dashboard
 * groups every visit to a screen under a single row.
 */
export function routePatternFromMatches(matches: ReadonlyArray<PatternMatch>): string {
  const leaf = matches[matches.length - 1]
  if (!leaf || leaf.routeId === '__root__') return NOT_FOUND

  const pattern = leaf.fullPath.split('/').map(normalizeSegment).join('/')
  return pattern.length > 1 && pattern.endsWith('/') ? pattern.slice(0, -1) : pattern
}
