import { z } from 'zod'

// Load .env into process.env when present (Node >= 20.12). In production the
// real environment wins and no file is required.
try {
  process.loadEnvFile()
} catch {
  // no .env file — fine, rely on the actual environment
}

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url().default('postgres://kumite:kumite@localhost:5433/kumite'),
  JWT_SECRET: z.string().min(1),
  JUDGE_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  JUDGE_MEMORY_MB: z.coerce.number().int().positive().default(64),
  JUDGE_CONCURRENCY: z.coerce.number().int().positive().default(4),
  SUBMISSION_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(5000),
  SUBMISSION_MAX_BODY_BYTES: z.coerce.number().int().positive().default(262144),
})

export const env = EnvSchema.parse(process.env)

export const JWT_SECRET = env.JWT_SECRET
export const TOKEN_TTL_SECONDS = 60 * 60 * 24
export const JUDGE_TIMEOUT_MS = env.JUDGE_TIMEOUT_MS
export const JUDGE_MEMORY_MB = env.JUDGE_MEMORY_MB
export const JUDGE_CONCURRENCY = env.JUDGE_CONCURRENCY
export const SUBMISSION_COOLDOWN_MS = env.SUBMISSION_COOLDOWN_MS
export const SUBMISSION_MAX_BODY_BYTES = env.SUBMISSION_MAX_BODY_BYTES
