import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'

/**
 * The caller's address, as trusted for anti-abuse accounting.
 *
 * Reads the **last** `X-Forwarded-For` entry, not the first: in production the
 * API sits behind Caddy's `reverse_proxy`, which appends the socket peer it
 * actually saw to whatever header the client sent. The leftmost entry — the
 * one most examples reach for — is therefore attacker-controlled, and using it
 * would let a single client mint a fresh throttle bucket per request. Without
 * a proxy in front (local dev, tests) there is no header and the socket
 * address answers instead.
 */
export function clientIp(c: Context): string {
  const forwardedFor = c.req.header('x-forwarded-for')
  const lastHop = forwardedFor?.split(',').at(-1)?.trim()
  if (lastHop) return lastHop

  return getConnInfo(c).remote.address ?? 'unknown'
}
