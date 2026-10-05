import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// The CLI's module graph loads in full before `--help` is handled (ESM
// imports are hoisted), so these runs prove it never reaches ../config.ts at
// runtime: a load run against a remote back has no JWT_SECRET to give it.

const backDir = fileURLToPath(new URL('../../', import.meta.url))

function runCli(args: string[], extraEnv: Record<string, string> = {}) {
  const env: Record<string, string> = { ...extraEnv }
  for (const key of ['PATH', 'HOME', 'TMPDIR']) {
    const value = process.env[key]
    if (value) env[key] = value
  }
  return spawnSync(`${backDir}node_modules/.bin/tsx`, [`${backDir}src/load/main.ts`, ...args], {
    // Not back/: config.ts would load back/.env (JWT_SECRET included) from
    // the working directory and hide an accidental import.
    cwd: mkdtempSync(join(tmpdir(), 'load-cli-')),
    // No JWT_SECRET, no DATABASE_URL: only what a shell on another machine has.
    env,
    encoding: 'utf8',
    timeout: 60_000,
  })
}

describe('pnpm load', { timeout: 120_000 }, () => {
  it('prints the usage with no back environment at all', () => {
    const result = runCli(['--help'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Usage: pnpm load <baseline|smoke>')
  })

  it('exits 2 on a bad configuration, naming the flag', () => {
    const result = runCli(['smoke', '--teams', 'zero'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('--teams')
  })

  it('exits 2 and refuses a remote target without --allow-remote', () => {
    const result = runCli(['smoke', '--url', 'https://api.example.com'], {
      ORGANIZER_EMAIL: 'org@edu.pucrs.br',
      ORGANIZER_PASSWORD: 'supersecret',
    })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('--allow-remote')
  })
})
