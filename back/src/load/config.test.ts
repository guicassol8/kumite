import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { assertTargetAllowed, PRESETS, parseLoadConfig, readEnvFile } from './config'

const ORGANIZER = { ORGANIZER_EMAIL: 'org@edu.pucrs.br', ORGANIZER_PASSWORD: 'supersecret' }

function parse(argv: string[], env: Record<string, string | undefined> = ORGANIZER, envFile = {}) {
  return parseLoadConfig({ argv, env, envFile, defaultOut: '/tmp/out' })
}

describe('parseLoadConfig', () => {
  it('takes the preset when no flag is given', () => {
    const result = parse(['smoke'])
    if (!result.ok) throw new Error(result.message)
    expect(result.config).toMatchObject({ scenario: 'smoke', ...PRESETS.smoke })
    expect(result.config.url).toBe('http://localhost:3000')
    expect(result.config.allowRemote).toBe(false)
  })

  it('lets a flag win over the preset', () => {
    const result = parse(['baseline', '--sse', '300', '--bad-fraction', '0.5', '--allow-remote'])
    if (!result.ok) throw new Error(result.message)
    expect(result.config.sse).toBe(300)
    expect(result.config.badFraction).toBe(0.5)
    expect(result.config.teams).toBe(PRESETS.baseline.teams)
    expect(result.config.allowRemote).toBe(true)
  })

  it('builds the default url from PORT, the shell winning over back/.env', () => {
    const fromFile = parse(['smoke'], ORGANIZER, { PORT: '3136' })
    const fromShell = parse(['smoke'], { ...ORGANIZER, PORT: '4000' }, { PORT: '3136' })
    const explicit = parse(['smoke'], { ...ORGANIZER, LOAD_API_URL: 'http://127.0.0.1:9/' })
    expect(fromFile.ok && fromFile.config.url).toBe('http://localhost:3136')
    expect(fromShell.ok && fromShell.config.url).toBe('http://localhost:4000')
    expect(explicit.ok && explicit.config.url).toBe('http://127.0.0.1:9')
  })

  it('reads the organizer from back/.env when the shell has none', () => {
    const result = parse(['smoke'], {}, ORGANIZER)
    if (!result.ok) throw new Error(result.message)
    expect(result.config.organizerEmail).toBe('org@edu.pucrs.br')
  })

  it('names the offending flag in a clear message', () => {
    const result = parse(['smoke', '--teams', 'zero', '--bad-fraction', '2'])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('--teams')
    expect(result.message).toContain('--bad-fraction')
  })

  it('refuses an unknown scenario, an unknown flag and missing organizer credentials', () => {
    const scenario = parse(['stress'])
    const flag = parse(['smoke', '--nope', '1'])
    const organizer = parse(['smoke'], {})
    expect(!scenario.ok && scenario.message).toContain('scenario must be one of')
    expect(flag.ok).toBe(false)
    expect(!organizer.ok && organizer.message).toContain('ORGANIZER_EMAIL')
  })
})

describe('readEnvFile', () => {
  it('parses a .env file and returns {} for a missing one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'load-config-'))
    const path = join(dir, '.env')
    writeFileSync(path, '# comment\nPORT=3136\nORGANIZER_EMAIL="a@edu.pucrs.br"\n')
    expect(readEnvFile(path)).toEqual({ PORT: '3136', ORGANIZER_EMAIL: 'a@edu.pucrs.br' })
    expect(readEnvFile(join(dir, 'missing.env'))).toEqual({})
  })
})

describe('assertTargetAllowed', () => {
  it('allows the local hosts', () => {
    expect(assertTargetAllowed('http://localhost:3000', false)).toBeNull()
    expect(assertTargetAllowed('http://127.0.0.1:3000', false)).toBeNull()
    expect(assertTargetAllowed('http://[::1]:3000', false)).toBeNull()
  })

  it('refuses a remote host without --allow-remote, and allows it with', () => {
    expect(assertTargetAllowed('https://api.kumite.example', false)).toContain('--allow-remote')
    expect(assertTargetAllowed('https://api.kumite.example', true)).toBeNull()
  })
})
