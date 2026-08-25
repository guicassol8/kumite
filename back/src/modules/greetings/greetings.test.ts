import { describe, expect, it } from 'vitest'

import { createGreeting, getGreeting } from './greetings.service'

describe('greetings.service', () => {
  it('creates a greeting with a generated id and a message', () => {
    const greeting = createGreeting({ name: 'Ada' })
    expect(greeting.id.length).toBeGreaterThan(0)
    expect(greeting.message).toBe('Hello, Ada!')
  })

  it('reads a created greeting back by id', () => {
    const created = createGreeting({ name: 'Linus' })
    expect(getGreeting(created.id)).toEqual(created)
  })

  it('returns null for an unknown id', () => {
    expect(getGreeting('does-not-exist')).toBeNull()
  })
})
