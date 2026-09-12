import { createRouter } from '@tanstack/react-router'

import { NotFoundScreen } from '@/components/not-found-screen'
import { RouteErrorScreen } from '@/components/route-error-screen'
import { routeTree } from '@/routeTree.gen'

export function createAppRouter() {
  return createRouter({
    routeTree,
    defaultNotFoundComponent: NotFoundScreen,
    defaultErrorComponent: RouteErrorScreen,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
