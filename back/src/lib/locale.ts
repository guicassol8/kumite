import { z } from 'zod'

// Single source of truth for supported locales — adding a language means
// touching only this union.
export const LocaleSchema = z.enum(['pt', 'es', 'en'])

export type Locale = z.infer<typeof LocaleSchema>
