import { describe, expect, it } from 'vitest'

import { checkHealth } from './health.service'

describe('checkHealth', () => {
  it('reports ok', () => {
    expect(checkHealth()).toEqual({ status: 'ok' })
  })
})
