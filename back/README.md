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
| POST   | /greetings        | Create a greeting (body: `{ "name" }`) |
| GET    | /greetings/:id    | Read a greeting by id (404 if absent) |

```bash
curl localhost:3000/health
curl -X POST localhost:3000/greetings -H 'content-type: application/json' -d '{"name":"Ada"}'
```

## Verify your work

- `pnpm test`      — unit tests (Vitest).
- `pnpm typecheck` — `tsc --noEmit`.
- `kata verify`    — fast deterministic lint rules (ADR-0003/0004/0005).
- `pnpm hurl`      — API E2E (needs [Hurl](https://hurl.dev) installed and the
  server running: `pnpm start` in another terminal).

## Add a module

```bash
kata new orders   # scaffolds src/modules/orders/ (route/service/schema/test/hurl)
```

Then register it in `src/app.ts`:

```ts
import * as orders from './modules/orders/orders.route'
// ...
createApp({ modules: [health, greetings, orders], middlewares: [requestLogger] })
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
