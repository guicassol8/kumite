# front — agent instructions

React SPA: Vite · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
TanStack Router (file-based) + TanStack Query · i18next · zod ^3.

## Commands (run from the repo root)

- `pnpm dev:front` — dev server on http://localhost:5173
- `pnpm --filter @kumite/front test` — vitest (jsdom)
- `pnpm --filter @kumite/front typecheck`
- `pnpm e2e` — Playwright (boots back + front itself) with this tree's
  `back/.env` and a slot in the machine's E2E semaphore; in a linked
  worktree, `pnpm worktree:env` first (`docs/workflow.md` § Worktrees)

## Conventions

- API calls ONLY through `src/lib/api.ts` (the `hc<AppType>` typed client),
  wrapped in TanStack Query. Never `fetch` by hand, never re-declare API types.
- Routes are files in `src/routes/` — the router plugin generates
  `src/routeTree.gen.ts` (never edit it; committed).
- Components: shadcn primitives in `src/components/ui/` (add more with
  `pnpm dlx shadcn@latest add <name>` from `front/`); app components in
  `src/components/`.
- Styling: Tailwind utilities + the tokens in `src/index.css`. No inline
  `style`, no new CSS files. The tokens come from `docs/design/tokens/`
  (identity spec: `docs/design/identity.md`) — change them there first, then
  mirror in `index.css`.
- i18n: every user-visible string goes through `useTranslation()` and the key
  is added to ALL of `src/i18n/{pt,es,en}.json` — the catalog parity test
  fails the suite otherwise.
- Every interactive or asserted element gets a `data-testid`.
- No test reaches the real network: the guard in `src/test/network-guard-jsdom.ts`
  fails any test that lets a `fetch` through. A test that mounts a route either
  mocks **both** `@/lib/api` and `@/lib/sse-client` (the SSE reader fetches
  outside the RPC client, so the api mock never covers it), or mounts a minimal
  route tree of its own instead of `routeTree.gen` — see
  `src/components/header.test.tsx`. Need a controlled `fetch`? Use
  `vi.stubGlobal('fetch', …)`; there is no allowlist.
- Review evidence: Playwright specs in `e2e/` write screenshots to the
  git-ignored `e2e/evidence/<issue>/`; the review attaches them to a PR
  comment (`gh pr comment --attach`, #402), never commits them (see
  `docs/task-workflow/reviewing-tasks.md`). A screenshot offered as proof of a
  theme asserts its pixels with `expectPaintedAsComputed`
  (`e2e/support/screenshot-pixels.ts`): a computed style is not a pixel, and
  #258 reported a headless capture in the old theme while every computed
  style read the new one.
- Telemetry lives ONLY in `<VercelAnalytics />` (`src/components/analytics.tsx`),
  mounted once in `src/routes/__root.tsx`. Nothing else imports
  `@vercel/analytics` or `@vercel/speed-insights`, and it reports the route
  *pattern* (`/problem/[id]`), never the visited URL. It is inert unless
  `VITE_VERCEL_ENV === 'production'`.
