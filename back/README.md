# back

A new [Kata](https://github.com/VicenzoMF/kata) app, scaffolded with `kata init`.

## Run it

```bash
pnpm install
pnpm dev        # tsx watch src/main.ts -> http://localhost:3000
```

## Endpoints

| Method | Path              | Description                          |
|--------|-------------------|--------------------------------------|
| GET    | /health           | Liveness probe -> `{ "status": "ok" }` |

```bash
curl localhost:3000/health
```

## Verify your work

- `pnpm test`      — unit tests (Vitest).
- `pnpm typecheck` — `tsc --noEmit`.
- `kata verify`    — fast deterministic lint rules (ADR-0003/0004/0005).
- `pnpm hurl`      — API E2E (needs [Hurl](https://hurl.dev) installed and the
  server running: `pnpm start` in another terminal).

## Continuous integration

The CI `hurl` job runs the same recipe as the local Hurl suite — start the
server, wait for it to accept connections, run Hurl, tear the server down:

```bash
pnpm start &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
npx --yes wait-on tcp:3000 --timeout 30000
pnpm hurl
```

## Add a module

```bash
kata new orders   # scaffolds src/modules/orders/ (route/service/schema/test/hurl)
```

Then register it in `src/app.ts`:

```ts
import * as orders from './modules/orders/orders.route'
// ...
createApp({ modules: [health, orders], middlewares: [requestLogger] })
```

## Layout

```
src/
├── app.ts                # createApp({ modules, middlewares })
├── context.ts            # defineContext({ ... }) — the typed DI surface
├── main.ts               # serve(app)
├── middlewares/
└── modules/<domain>/     # route / service / schema / test / hurl
```

See `AGENTS.md` for the conventions every agent (and you) should follow.
