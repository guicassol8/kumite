import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { parseEnv } from './env'

const OPTIONS = { subject: 'test environment', hint: 'See back/.env.example.' }

const Schema = z.object({
  REQUIRED_ONE: z.string().min(1),
  REQUIRED_TWO: z.string().url(),
  WITH_DEFAULT: z.coerce.number().int().default(7),
})

function parse(source: NodeJS.ProcessEnv) {
  return parseEnv(Schema, source, OPTIONS)
}

function messageFor(source: NodeJS.ProcessEnv): string {
  try {
    parse(source)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('expected parseEnv to throw')
}

describe('parseEnv', () => {
  it('returns the parsed data, defaults applied, when every variable is valid', () => {
    const env = parse({ REQUIRED_ONE: 'x', REQUIRED_TWO: 'https://kumite.dev' })

    // Also the type contract: these only compile because parseEnv infers the
    // schema's output type, which is what config.ts's consumers depend on.
    const port: number = env.WITH_DEFAULT
    const one: string = env.REQUIRED_ONE
    expect(port).toBe(7)
    expect(one).toBe('x')
    expect(env.REQUIRED_TWO).toBe('https://kumite.dev')
  })

  it('names the missing variable and points at the hint', () => {
    const message = messageFor({ REQUIRED_TWO: 'https://kumite.dev' })

    expect(message).toContain('Invalid test environment')
    expect(message).toContain('REQUIRED_ONE: required, but not set')
    expect(message).toContain('See back/.env.example.')
  })

  // The whole point of the issue: a developer with two variables missing must
  // see both at once instead of fixing one, re-running, and finding the next.
  it('lists every offending variable, not just the first', () => {
    const message = messageFor({})

    expect(message).toContain('2 variables missing or invalid')
    expect(message).toContain('REQUIRED_ONE: required, but not set')
    expect(message).toContain('REQUIRED_TWO: required, but not set')
  })

  it('reports an invalid value with zod’s own explanation', () => {
    const message = messageFor({ REQUIRED_ONE: 'x', REQUIRED_TWO: 'not-a-url' })

    expect(message).toContain('1 variable missing or invalid')
    expect(message).toContain('REQUIRED_TWO: Invalid url')
  })

  // DATABASE_URL and JWT_SECRET are secrets: a malformed value with a password
  // inside must never reach CI's stdout.
  it('never echoes the received value', () => {
    const Secret = z.object({ DATABASE_URL: z.string().url() })

    let message = ''
    try {
      parseEnv(Secret, { DATABASE_URL: '//kumite:hunter2@localhost/kumite' }, OPTIONS)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toContain('DATABASE_URL: Invalid url')
    expect(message).not.toContain('hunter2')
    expect(message).not.toContain('localhost')
  })

  it('emits one bullet per variable even when zod reports several issues for it', () => {
    const Multi = z.object({ TOKEN: z.string().min(10).endsWith('!') })

    let message = ''
    try {
      parseEnv(Multi, { TOKEN: 'short' }, OPTIONS)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message.match(/^ {2}- TOKEN:/gm)).toHaveLength(1)
    expect(message).toContain('1 variable missing or invalid')
  })

  it('throws a plain Error whose stack is the message, not a ZodError', () => {
    let thrown: unknown
    try {
      parse({})
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown).not.toBeInstanceOf(z.ZodError)
    const error = thrown as Error
    // Vitest prints the stack under every failing file; a frame pointing at
    // config.ts helps nobody and buries the one line that does.
    expect(error.stack).toBe(error.message)
  })
})
