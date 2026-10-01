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
// That fallback is guaranteed: the back below always boots without SES (#416).
const notificationsLog = process.env.BACK_NOTIFICATIONS_LOG
const backCommand = notificationsLog
  ? `pnpm --filter @kumite/back dev 2>&1 | tee '${notificationsLog}'`
  : 'pnpm --filter @kumite/back dev'
// GitHub Actions sets CI=true for the `e2e` job in ci.yml (#295); `CI=1`
// locally reproduces its reporter/retry behaviour.
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  // Closes any round a previous run left open, once, before the workers start
  // — the single open-round slot is global, and a leftover would otherwise
  // 409 every spec that needs to open one (#150).
  globalSetup: './e2e/support/global-setup.ts',
  // The 5s default only holds on an idle machine. Waiting for Blockly to
  // inject is the exception that outgrows even this: it has its own budget in
  // `expectBlocklyInjected` (e2e/support/blockly.ts), with the test budget
  // derived from it — raise that, never this ceiling (#246).
  expect: { timeout: 30_000 },
  // Every worker is a Chromium holding a Blockly workspace — hundreds of MB
  // each. The default (half the cores) outgrows a small machine, and once it
  // starts swapping the renderer stalls with the page still blank: the suite
  // then fails on a different spec every run, with no error to show for it.
  // Two is a floor that keeps the suite honest, not a cure for a full machine.
  workers: 2,
  // A stray `test.only` would silently shrink the CI gate to one spec.
  forbidOnly: isCI,
  // #295: one retry in CI only. A spec that passes on retry is reported as
  // flaky (html + GitHub annotations) instead of failing the gate. A flake is
  // fixed at its cause, not hidden here: #338 (the header Tab walk) was.
  retries: isCI ? 1 : 0,
  // Local runs keep Playwright's default `list`; CI adds the HTML report the
  // `e2e` job uploads as an artifact and inline annotations on the PR.
  reporter: isCI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${frontPort}`,
    // Browser-language detection (#56) reads navigator.language. Pin it to
    // PT so every pre-existing spec keeps its PT-language assertions;
    // language-selector.spec.ts overrides this per describe block.
    locale: 'pt-BR',
    // Failure diagnostics for the uploaded report. Without retries (local runs)
    // there is no first retry, so no trace is ever recorded there.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: backCommand,
      url: `http://localhost:${backPort}/health`,
      reuseExistingServer: true,
      cwd: '..',
      // The back's CORS allowlist is APP_BASE_URL plus localhost:5173 (#273),
      // so a front on a non-default FRONT_PORT would be refused unless the
      // back it talks to allows that origin. Playwright merges this over
      // process.env (and back/.env never overrides a variable already set).
      // Only applies to a back Playwright starts itself: with
      // reuseExistingServer an already-running back keeps its own
      // APP_BASE_URL — set it in back/.env (docs/workflow.md § Worktrees).
      //
      // No SES, ever (#416). back/.env may carry real SES credentials —
      // `pnpm e2e` exports it and `pnpm worktree:env` copies it from the main
      // checkout — and with them the back mails the specs' throwaway
      // addresses and the organizers' bug-report inbox, and never logs the
      // OTP the real-OTP specs wait for. Blanked, not deleted: config.ts's
      // loadEnvFile() fills in only names absent from process.env, so a
      // delete would be undone by back/.env, while an empty value counts as
      // unset (optionalNonEmptyString) — the same move as back/vitest.setup.ts.
      // Like APP_BASE_URL, this only reaches a back Playwright starts itself.
      env: {
        APP_BASE_URL: `http://localhost:${frontPort}`,
        SES_REGION: '',
        SES_ACCESS_KEY_ID: '',
        SES_SECRET_ACCESS_KEY: '',
      },
    },
    {
      command: `pnpm --filter @kumite/front dev --port ${frontPort} --strictPort`,
      url: `http://localhost:${frontPort}`,
      reuseExistingServer: true,
      cwd: '..',
    },
  ],
})
