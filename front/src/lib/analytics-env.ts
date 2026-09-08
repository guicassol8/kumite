/**
 * Telemetry only runs on the production deployment.
 *
 * `VITE_VERCEL_ENV` is Vercel's own system env var, exposed to the Vite build
 * once *Enable access to System Environment Variables* is on for the project.
 * It is `preview` on preview deployments and undefined in local dev and under
 * vitest — so both stay silent without any extra opt-out.
 *
 * A function, not a constant, so tests can drive it with `vi.stubEnv`.
 */
export function isAnalyticsEnabled(): boolean {
  return import.meta.env.VITE_VERCEL_ENV === 'production'
}
