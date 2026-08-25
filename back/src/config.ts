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
})

export const env = EnvSchema.parse(process.env)
