import { defineConfig } from '@playwright/test'

// E2E + visual evidence. `webServer` boots the API and the front, so a bare
// `pnpm e2e` works from a cold checkout (db not required for the smoke test).
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: [
    {
      command: 'pnpm --filter @kumite/back dev',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      cwd: '..',
    },
    {
      command: 'pnpm --filter @kumite/front dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      cwd: '..',
    },
  ],
})
