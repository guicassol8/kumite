import { defineConfig } from '@playwright/test'

// E2E + visual evidence. `webServer` boots the API and the front, so a bare
// `pnpm e2e` works from a cold checkout (db not required for the smoke test).
// PORT/FRONT_PORT default to 3000/5173; override them (and front's
// VITE_API_URL) via .env when those ports are already taken by something else
// on the machine. --strictPort makes the front fail loudly instead of
// silently binding to a different port than the one this config points at.
const backPort = process.env.PORT ?? '3000'
const frontPort = process.env.FRONT_PORT ?? '5173'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: `http://localhost:${frontPort}`,
  },
  webServer: [
    {
      command: 'pnpm --filter @kumite/back dev',
      url: `http://localhost:${backPort}/health`,
      reuseExistingServer: true,
      cwd: '..',
    },
    {
      command: `pnpm --filter @kumite/front dev --port ${frontPort} --strictPort`,
      url: `http://localhost:${frontPort}`,
      reuseExistingServer: true,
      cwd: '..',
    },
  ],
})
