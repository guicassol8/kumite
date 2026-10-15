import { describe, expect, it, vi } from 'vitest'

import { ROUTE_FILE_IGNORE_PATTERN } from './route-file-ignore'

// route-file-ignore.test.ts proves the pattern; this proves vite.config.ts
// hands it to the router plugin — without that line the 25 "does not export
// a Route" warnings come back on every dev boot and build, and no other test
// notices (#328). The plugins and vite are stubbed: only the options matter.
const { tanstackRouter } = vi.hoisted(() => ({
  tanstackRouter: vi.fn((_options: Record<string, unknown>) => ({ name: 'router-stub' })),
}))
vi.mock('@tanstack/router-plugin/vite', () => ({ tanstackRouter }))
vi.mock('@vitejs/plugin-react', () => ({ default: () => ({ name: 'react-stub' }) }))
vi.mock('@tailwindcss/vite', () => ({ default: () => ({ name: 'tailwind-stub' }) }))
// vite itself pulls in esbuild, which refuses to load under jsdom.
vi.mock('vite', () => ({ defineConfig: <T>(config: T) => config }))

describe('vite.config router plugin (#328)', () => {
  it('passes ROUTE_FILE_IGNORE_PATTERN to the router plugin, keeping the "-" prefix default', async () => {
    await import('../../vite.config')
    expect(tanstackRouter).toHaveBeenCalledTimes(1)
    const options = tanstackRouter.mock.calls[0]?.[0]
    expect(options?.routeFileIgnorePattern).toBe(ROUTE_FILE_IGNORE_PATTERN)
    expect(options).not.toHaveProperty('routeFileIgnorePrefix')
  })
})
