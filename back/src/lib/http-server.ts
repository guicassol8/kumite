import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { serve } from '@hono/node-server'

/**
 * The back's HTTP server timeouts (#438): an idle keep-alive socket is always
 * closed by Caddy first, never by the back.
 *
 * The race this closes: when the back drops an idle socket at the same moment
 * Caddy reuses it for the next request, the request dies before any response
 * byte. Neither Caddy nor Go's net/http resend it if it is a POST, so the
 * participant gets a 502 on submit, at the end-of-round peak, where event-loop
 * stalls (#439) widen the window.
 *
 * Defaults, read in the exact versions running on the VPS (2026-10-05):
 * - Caddy v2.11.4 keeps an idle upstream socket 2 min
 *   (modules/caddyhttp/reverseproxy/httptransport.go:213-214, IdleConnTimeout
 *   0 → 2 * time.Minute). The Caddyfile pins it (`keepalive 2m`) so the
 *   floating `caddy:2-alpine` tag cannot move it silently; http-server.test.ts
 *   reads it from there and fails if the back would close first.
 * - Caddy does not retry a failed POST by default (reverseproxy.go:1324-1360,
 *   tryAgain with TryDuration 0 and Retries 0) and answers 502
 *   (reverseproxy.go:1598-1606).
 * - Go 1.25.1 net/http only replays a request written to a reused connection
 *   when it is replayable (transport.go:808-853, request.go:1534-1548): GET,
 *   HEAD, OPTIONS or TRACE without a body, or with Idempotency-Key. Never a
 *   POST with a body. Go also ignores the back's `Keep-Alive: timeout=` header,
 *   so Caddy's pool keeps its 2 min whatever the back announces.
 * - Node v22.23.3 (lib/_http_server.js): keepAliveTimeout 5 000 (481-486),
 *   headersTimeout min(60 000, requestTimeout) (469-474), requestTimeout
 *   300 000 (461-466); createServer throws unless headersTimeout <=
 *   requestTimeout (477-478). The socket really closes at keepAliveTimeout +
 *   keepAliveTimeoutBuffer (1 000 by default, 489-494 and 1041-1050), while
 *   the header announces keepAliveTimeout alone.
 *
 * Hence:
 * - keepAliveTimeout 130 000: the back announces `timeout=130` and closes at
 *   131 s, 11 s after Caddy's 120 s, room for multi-hundred-ms loop stalls.
 *   Clients that honor the header (undici, the load harness) keep the socket
 *   ~128 s, so the race is gone for them too.
 * - headersTimeout 135 000: above the real close (131 s), as Node requires for
 *   keep-alive to work, and within requestTimeout's 300 000. The looser
 *   slowloris guard is fine: in production the back publishes no port, only
 *   Caddy's 80/443, and Caddy sends the headers at once.
 *
 * Constants, not env vars: they are bound to the Caddyfile, not to an instance.
 * This module never imports config.ts, so its test runs without an env.
 */
export const SERVER_TIMEOUTS = {
  keepAliveTimeout: 130_000,
  headersTimeout: 135_000,
} as const

type FetchHandler = (request: Request) => Response | Promise<Response>

/** `serve()` from @hono/node-server with {@link SERVER_TIMEOUTS} applied. */
export function serveApp(
  fetch: FetchHandler,
  port: number,
  onListen?: (info: AddressInfo) => void,
): Server {
  return serve({ fetch, port, serverOptions: SERVER_TIMEOUTS }, onListen) as Server
}
