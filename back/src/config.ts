import { z } from 'zod'

import { parseEnv } from './lib/env'

// Load .env into process.env when present (Node >= 20.12). In production the
// real environment wins and no file is required.
try {
  process.loadEnvFile()
} catch {
  // no .env file — fine, rely on the actual environment
}

// Treats an explicitly blank env var (`SES_REGION=` in .env, as documented in
// .env.example) the same as an unset one — z's own `.optional()` only skips
// `undefined`, not `''`, and would otherwise fail EnvSchema.parse() for
// anyone following .env.example's own setup instructions verbatim.
const optionalNonEmptyString = () =>
  z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional())

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  // Public origin of the front, used to build absolute links inside emails
  // (#162) — a relative path is not clickable in any email client. The
  // trailing slash is stripped so `${APP_BASE_URL}/reset-password` never
  // becomes `//reset-password`.
  APP_BASE_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .url()
      .default('http://localhost:5173')
      .transform((url) => url.replace(/\/+$/, '')),
  ),
  DATABASE_URL: z.string().url().default('postgres://kumite:kumite@localhost:5433/kumite'),
  JWT_SECRET: z.string().min(1),
  JUDGE_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  JUDGE_MEMORY_MB: z.coerce.number().int().positive().default(64),
  JUDGE_CONCURRENCY: z.coerce.number().int().positive().default(4),
  SUBMISSION_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(5000),
  SUBMISSION_MAX_BODY_BYTES: z.coerce.number().int().positive().default(262144),
  // Password-reset anti-abuse (#142): one sliding window, three ceilings.
  PASSWORD_RESET_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  PASSWORD_RESET_MAX_PER_EMAIL: z.coerce.number().int().positive().default(3),
  PASSWORD_RESET_MAX_PER_IP: z.coerce.number().int().positive().default(20),
  PASSWORD_RESET_COMPLETE_MAX_PER_IP: z.coerce.number().int().positive().default(30),
  // Organizer step-up (#143): wrong admin passwords tolerated per organizer
  // inside the same PASSWORD_RESET_WINDOW_MS. Keyed by the acting organizer,
  // not by IP — the session is already authenticated.
  PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER: z.coerce.number().int().positive().default(5),
  // All optional: SES email sending (notifications.service.ts) falls back to
  // console.log when any of these is missing — keeps CI's hurl job (no AWS
  // secrets available) and local dev/test green with zero AWS config.
  SES_REGION: optionalNonEmptyString(),
  SES_ACCESS_KEY_ID: optionalNonEmptyString(),
  SES_SECRET_ACCESS_KEY: optionalNonEmptyString(),
  SES_FROM_EMAIL: z
    .string()
    .min(1)
    .default('Liga de Algoritmos - PUCRS <contato@ligadealgoritmos.com>'),
  // In-app bug reports (src/modules/bug-reports, #145). The inbox that
  // receives them, and the per-IP cooldown that keeps POST /bug-reports —
  // a public, unauthenticated route — from being a free mail relay.
  BUG_REPORT_TO_EMAIL: z.string().min(1).default('ligadealgoritmos@gmail.com'),
  BUG_REPORT_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(60000),
})

export const env = parseEnv(EnvSchema, process.env, {
  subject: 'back/ environment',
  hint: 'See back/.env.example for every value and which ones are required.',
})

export const JWT_SECRET = env.JWT_SECRET
export const APP_BASE_URL = env.APP_BASE_URL
export const TOKEN_TTL_SECONDS = 60 * 60 * 24
export const JUDGE_TIMEOUT_MS = env.JUDGE_TIMEOUT_MS
export const JUDGE_MEMORY_MB = env.JUDGE_MEMORY_MB
export const JUDGE_CONCURRENCY = env.JUDGE_CONCURRENCY
export const SUBMISSION_COOLDOWN_MS = env.SUBMISSION_COOLDOWN_MS
export const SUBMISSION_MAX_BODY_BYTES = env.SUBMISSION_MAX_BODY_BYTES
export const PASSWORD_RESET_WINDOW_MS = env.PASSWORD_RESET_WINDOW_MS
export const PASSWORD_RESET_MAX_PER_EMAIL = env.PASSWORD_RESET_MAX_PER_EMAIL
export const PASSWORD_RESET_MAX_PER_IP = env.PASSWORD_RESET_MAX_PER_IP
export const PASSWORD_RESET_COMPLETE_MAX_PER_IP = env.PASSWORD_RESET_COMPLETE_MAX_PER_IP
export const PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER = env.PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER
export const SES_REGION = env.SES_REGION
export const SES_ACCESS_KEY_ID = env.SES_ACCESS_KEY_ID
export const SES_SECRET_ACCESS_KEY = env.SES_SECRET_ACCESS_KEY
export const SES_FROM_EMAIL = env.SES_FROM_EMAIL
export const BUG_REPORT_TO_EMAIL = env.BUG_REPORT_TO_EMAIL
export const BUG_REPORT_COOLDOWN_MS = env.BUG_REPORT_COOLDOWN_MS
