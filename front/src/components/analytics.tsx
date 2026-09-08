import { useRouterState } from '@tanstack/react-router'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { useCallback, useRef } from 'react'

import { isAnalyticsEnabled } from '@/lib/analytics-env'
import { routePatternFromMatches } from '@/lib/route-pattern'

/**
 * The single mount point for Vercel Web Analytics and Speed Insights — nothing
 * else in the app imports `@vercel/*` directly.
 *
 * Two guarantees live here. It renders nothing outside the production
 * deployment, so `pnpm dev`, preview deploys and the test run never talk to
 * Vercel. And every datapoint carries the *route pattern* rather than the URL:
 * `route`/`path` feed the pattern to the libraries, and `beforeSend` rewrites
 * the url they would report, so a problem or round id never reaches the
 * dashboard and each screen stays one row instead of one per visited id.
 */
export function VercelAnalytics() {
  const route = useRouterState({ select: (state) => routePatternFromMatches(state.matches) })

  // Read through a ref so `scrub` keeps a stable identity: both libraries
  // register beforeSend once per handler, and a new function on every
  // navigation would re-register it on every navigation.
  const routeRef = useRef(route)
  routeRef.current = route

  const scrub = useCallback(<E extends { url: string }>(event: E): E => {
    let origin = window.location.origin
    try {
      origin = new URL(event.url).origin
    } catch {
      // Relative or malformed url — the page's own origin is the right guess.
    }
    return { ...event, url: origin + routeRef.current }
  }, [])

  if (!isAnalyticsEnabled()) return null

  return (
    <>
      <Analytics route={route} path={route} beforeSend={scrub} />
      <SpeedInsights route={route} beforeSend={scrub} />
    </>
  )
}
