import { describe, expect, it } from 'vitest'

import { formatDate, formatList, formatNumber, formatTime } from './format'

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

// #383: names the rounds that make the event total not comparable.
describe('formatList', () => {
  const ROUNDS = ['Rodada 1', 'Rodada 2', 'Rodada 3']

  it('joins with the Portuguese conjunction', () => {
    expect(formatList(ROUNDS.slice(0, 2), 'pt')).toBe('Rodada 1 e Rodada 2')
    expect(formatList(ROUNDS, 'pt')).toBe('Rodada 1, Rodada 2 e Rodada 3')
  })

  it('joins with the Spanish conjunction', () => {
    expect(formatList(ROUNDS.slice(0, 2), 'es')).toBe('Rodada 1 y Rodada 2')
  })

  it('joins with the English conjunction', () => {
    expect(formatList(ROUNDS.slice(0, 2), 'en')).toBe('Rodada 1 and Rodada 2')
    expect(formatList(ROUNDS, 'en')).toBe('Rodada 1, Rodada 2, and Rodada 3')
  })

  it('leaves a single item alone', () => {
    expect(formatList(['Rodada 1'], 'pt')).toBe('Rodada 1')
  })
})
