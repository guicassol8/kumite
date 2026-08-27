import { describe, expect, it } from 'vitest'

import { formatDate, formatNumber } from './format'

const NUMBER = 1234.5
const DATE = new Date(2026, 7, 27)

describe('formatNumber', () => {
  it('formats with pt-BR grouping/decimal separators', () => {
    expect(formatNumber(NUMBER, 'pt')).toBe('1.234,5')
  })

  it('formats with es-MX grouping/decimal separators', () => {
    expect(formatNumber(NUMBER, 'es')).toBe('1,234.5')
  })

  it('formats with en-US grouping/decimal separators', () => {
    expect(formatNumber(NUMBER, 'en')).toBe('1,234.5')
  })
})

describe('formatDate', () => {
  it('formats as pt-BR day/month/year', () => {
    expect(formatDate(DATE, 'pt')).toBe('27/08/2026')
  })

  it('formats as es-MX day/month/year', () => {
    expect(formatDate(DATE, 'es')).toBe('27/8/2026')
  })

  it('formats as en-US month/day/year', () => {
    expect(formatDate(DATE, 'en')).toBe('8/27/2026')
  })
})
