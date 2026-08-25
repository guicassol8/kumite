import type { AppType } from '@kumite/back'
import { hc } from 'hono/client'

// The typed RPC client. `AppType` is a type-only import — zero runtime coupling
// with the back; the contract (paths, inputs, outputs, status codes) is checked
// by the compiler. If the back changes a schema, `pnpm typecheck` breaks here.
export const api = hc<AppType>(import.meta.env.VITE_API_URL ?? 'http://localhost:3000')
