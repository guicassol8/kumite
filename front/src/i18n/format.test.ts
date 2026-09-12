import { describe, expect, it } from 'vitest'

import { formatDate, formatNumber, formatTime } from './format'

const NUMBER = 1234.5
const DATE = new Date(2026, 7, 27)
const DATE_TIME = new Date(2026, 7, 27, 13, 5)

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

describe('formatTime', () => {
  it('formats as pt-BR 24h time', () => {
    expect(formatTime(DATE_TIME, 'pt')).toBe('13:05')
  })

  it('formats as es-MX 12h time', () => {
    expect(formatTime(DATE_TIME, 'es')).toBe('01:05 p.m.')
  })

  it('formats as en-US 12h time', () => {
    expect(formatTime(DATE_TIME, 'en')).toBe('01:05 PM')
  })
})
