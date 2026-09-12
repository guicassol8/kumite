import { describe, expect, it } from 'vitest'

import { NotFoundScreen } from '@/components/not-found-screen'
import { RouteErrorScreen } from '@/components/route-error-screen'
import { createAppRouter } from '@/lib/router'

// The router plugs the two global shells (#230). This is the guard that keeps
// them wired: it fails loud if a refactor swaps createAppRouter's options
// back to the router's own defaults.
describe('createAppRouter', () => {
  it('plugs NotFoundScreen as the default 404', () => {
    expect(createAppRouter().options.defaultNotFoundComponent).toBe(NotFoundScreen)
  })

  it('plugs RouteErrorScreen as the default render-error screen', () => {
    expect(createAppRouter().options.defaultErrorComponent).toBe(RouteErrorScreen)
  })
})
