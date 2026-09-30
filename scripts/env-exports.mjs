// Prints `export KEY='value'` for every variable of a dotenv file, for `eval`
// in bash (#404): `eval "$(node scripts/env-exports.mjs back/.env)"`.
//
// Parsed with node:util's parseEnv — the parser process.loadEnvFile() uses,
// so the shell sees exactly what the back sees — instead of `. back/.env`,
// which dies on a value bash cannot source (the unquoted `<…>` in
// back/.env.example's SES_FROM_EMAIL, #373).
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/env-exports.mjs <dotenv file>')
  process.exit(2)
}
const env = parseEnv(readFileSync(file, 'utf8'))
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`
for (const [key, value] of Object.entries(env)) {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) console.log(`export ${key}=${quote(value)}`)
}
