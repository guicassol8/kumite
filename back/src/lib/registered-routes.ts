// Reflection over the module list `app.ts` exports, shared by the cross-module
// guard suites (`src/auth-guards.test.ts`, `src/app.test.ts`).
//
// It leans on one kata internal: `defineRoute` stamps every route object with
// `__kata === 'route'`, which is how a namespace import's exports are told
// apart from the helpers and schemas sitting beside them. That marker is the
// single thing an upgrade could move, so it is spelled out once here instead
// of being copy-pasted into each suite that walks the routes — two copies
// would mean two places to fix, and the second one would be found by a test
// that quietly stopped asserting anything (an empty route list makes every
// "no offenders" check pass for the wrong reason).
//
// Callers that guard against that: assert the list is non-empty before
// concluding anything from it.

export type KataRoute = { method: string; path: string; use?: readonly unknown[] }

export function registeredRoutes(modules: readonly unknown[]): KataRoute[] {
  return modules.flatMap((module) =>
    Object.values(module as Record<string, unknown>).filter(
      (value): value is KataRoute =>
        typeof value === 'object' &&
        value !== null &&
        (value as { __kata?: string }).__kata === 'route',
    ),
  )
}
