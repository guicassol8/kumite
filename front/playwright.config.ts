import { defineConfig } from '@playwright/test'

// E2E + visual evidence. `webServer` boots the API and the front, so a bare
// `pnpm e2e` works from a cold checkout (db not required for the smoke test).
// PORT/FRONT_PORT default to 3000/5173; override them (and front's
// VITE_API_URL) via .env when those ports are already taken by something else
// on the machine. --strictPort makes the front fail loudly instead of
// silently binding to a different port than the one this config points at.
const backPort = process.env.PORT ?? '3000'
const frontPort = process.env.FRONT_PORT ?? '5173'
// reset-password.spec.ts reads the OTP from the back's stdout (the SES-less
// console.log fallback), so when BACK_NOTIFICATIONS_LOG names a file the back
// also tees its output there. Unset, the back boots exactly as before (#333).
const notificationsLog = process.env.BACK_NOTIFICATIONS_LOG
const backCommand = notificationsLog
  ? `pnpm --filter @kumite/back dev 2>&1 | tee '${notificationsLog}'`
  : 'pnpm --filter @kumite/back dev'

export default defineConfig({
  testDir: './e2e',
  // Closes any round a previous run left open, once, before the workers start
  // — the single open-round slot is global, and a leftover would otherwise
  // 409 every spec that needs to open one (#150).
  globalSetup: './e2e/support/global-setup.ts',
  // Injecting Blockly is the slowest thing every spec blocks on, and the 5s
  // default only holds on an idle machine.
  expect: { timeout: 30_000 },
  // Every worker is a Chromium holding a Blockly workspace — hundreds of MB
  // each. The default (half the cores) outgrows a small machine, and once it
  // starts swapping the renderer stalls with the page still blank: the suite
  // then fails on a different spec every run, with no error to show for it.
  // Two is a floor that keeps the suite honest, not a cure for a full machine.
  workers: 2,
  use: {
    baseURL: `http://localhost:${frontPort}`,
    // Browser-language detection (#56) reads navigator.language. Pin it to
    // PT so every pre-existing spec keeps its PT-language assertions;
    // language-selector.spec.ts overrides this per describe block.
    locale: 'pt-BR',
  },
  webServer: [
    {
      command: backCommand,
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
