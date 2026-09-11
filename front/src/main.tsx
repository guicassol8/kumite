import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './fonts'
import './i18n'
import './index.css'
import { queryClient } from './lib/query-client'
import { applyTheme } from './lib/theme'
import { purgeLegacyWorkspaceState } from './lib/workspace-storage'
import { routeTree } from './routeTree.gen'

// O script de index.html ja pos a classe dark no <html> antes do paint; esta
// chamada e quem alinha a meta theme-color ao modo, que o HTML estatico so
// consegue chutar como claro.
applyTheme()

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Before the first screen: the workspaces saved by the old build have no
// owner, so any account that opens the editor would read them (#175). They are
// the leak itself, not somebody's work worth keeping.
purgeLegacyWorkspaceState()

// biome-ignore lint/style/noNonNullAssertion: #root is guaranteed by index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
