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
})

export const env = EnvSchema.parse(process.env)

export const JWT_SECRET = env.JWT_SECRET
export const TOKEN_TTL_SECONDS = 60 * 60 * 24
