import { z } from 'zod'

// Load .env into process.env when present (Node >= 20.12). In production the
// real environment wins and no file is required.
try {
  process.loadEnvFile()
} catch {
  // no .env file — fine, rely on the actual environment
}

// Treats an explicitly blank env var (`AWS_REGION=` in .env, as documented in
// .env.example) the same as an unset one — z's own `.optional()` only skips
// `undefined`, not `''`, and would otherwise fail EnvSchema.parse() for
// anyone following .env.example's own setup instructions verbatim.
const optionalNonEmptyString = () =>
  z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional())

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
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
  AWS_REGION: optionalNonEmptyString(),
  AWS_ACCESS_KEY_ID: optionalNonEmptyString(),
  AWS_SECRET_ACCESS_KEY: optionalNonEmptyString(),
  SES_FROM_EMAIL: z
    .string()
    .min(1)
    .default('Liga de Algoritmos - PUCRS <contato@ligadealgoritmos.com>'),
})

export const env = EnvSchema.parse(process.env)

export const JWT_SECRET = env.JWT_SECRET
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
export const AWS_REGION = env.AWS_REGION
export const AWS_ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID
export const AWS_SECRET_ACCESS_KEY = env.AWS_SECRET_ACCESS_KEY
export const SES_FROM_EMAIL = env.SES_FROM_EMAIL
