// The absolute origin baked into the metadata that og:image, og:url and the
// manifest need (#230, #62: DNS for the real domain isn't live yet, so the
// default below is what ships until it is).
export const DEFAULT_SITE_URL = 'https://kumite.ligadealgoritmos.com'

export function resolveSiteUrl(env: { VITE_SITE_URL?: string }): string {
  const trimmed = env.VITE_SITE_URL?.trim()
  if (!trimmed) return DEFAULT_SITE_URL
  return trimmed.replace(/\/+$/, '')
}
