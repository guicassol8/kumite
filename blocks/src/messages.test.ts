import { describe, expect, it } from 'vitest'

import { type BlockLocale, DEFAULT_LOCALE, messages, messagesFor } from './messages'

const locales: BlockLocale[] = ['pt', 'es', 'en']

// Same contract as the front's `catalogs.test.ts`: a label added to one locale
// without the other two fails the suite.
describe('block messages', () => {
  it('pt, es and en expose exactly the same keys', () => {
    const reference = Object.keys(messages.pt).sort()
    expect(Object.keys(messages.es).sort()).toEqual(reference)
    expect(Object.keys(messages.en).sort()).toEqual(reference)
  })

  it('never ships an empty string', () => {
    for (const locale of locales) {
      for (const [key, value] of Object.entries(messages[locale])) {
        expect(value.trim(), `${locale}.${key}`).not.toBe('')
      }
    }
  })

  it('keeps the {type} placeholder in every block-not-allowed message', () => {
    for (const locale of locales) {
      expect(messages[locale].errorBlockNotAllowed, locale).toContain('{type}')
    }
  })

  it('falls back to pt when no locale is given', () => {
    expect(messagesFor()).toBe(messages.pt)
    expect(DEFAULT_LOCALE).toBe('pt')
  })
})
