# front — agent instructions

React SPA: Vite · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
TanStack Router (file-based) + TanStack Query · i18next · zod ^3.

## Commands (run from the repo root)

- `pnpm dev:front` — dev server on http://localhost:5173
- `pnpm --filter @kumite/front test` — vitest (jsdom)
- `pnpm --filter @kumite/front typecheck`
- `pnpm --filter @kumite/front e2e` — Playwright (boots back + front itself)

## Conventions

- API calls ONLY through `src/lib/api.ts` (the `hc<AppType>` typed client),
  wrapped in TanStack Query. Never `fetch` by hand, never re-declare API types.
- Routes are files in `src/routes/` — the router plugin generates
  `src/routeTree.gen.ts` (never edit it; committed).
- Components: shadcn primitives in `src/components/ui/` (add more with
  `pnpm dlx shadcn@latest add <name>` from `front/`); app components in
  `src/components/`.
- Styling: Tailwind utilities + the tokens in `src/index.css`. No inline
  `style`, no new CSS files.
- i18n: every user-visible string goes through `useTranslation()` and the key
  is added to ALL of `src/i18n/{pt,es,en}.json` — the catalog parity test
  fails the suite otherwise.
- Every interactive or asserted element gets a `data-testid`.
- Review evidence: Playwright specs in `e2e/`, screenshots committed to
  `e2e/evidence/<issue>/` (see `.claude/skills/reviewing-tasks`).
- Telemetry lives ONLY in `<VercelAnalytics />` (`src/components/analytics.tsx`),
  mounted once in `src/routes/__root.tsx`. Nothing else imports
  `@vercel/analytics` or `@vercel/speed-insights`, and it reports the route
  *pattern* (`/problem/[id]`), never the visited URL. It is inert unless
  `VITE_VERCEL_ENV === 'production'`.
