import { describe, expect, it } from 'vitest'

import { routePatternFromMatches } from './route-pattern'

const match = (routeId: string, fullPath: string) => ({ routeId, fullPath })

describe('routePatternFromMatches', () => {
  it('keeps static paths as they are', () => {
    expect(routePatternFromMatches([match('__root__', '/'), match('/', '/')])).toBe('/')
    expect(routePatternFromMatches([match('__root__', '/'), match('/teams', '/teams')])).toBe(
      '/teams',
    )
  })

  it('drops the trailing slash of index routes, except at the root', () => {
    expect(
      routePatternFromMatches([match('__root__', '/'), match('/organizer/', '/organizer/')]),
    ).toBe('/organizer')
  })

  it('replaces route params with a bracketed placeholder, never the real value', () => {
    expect(
      routePatternFromMatches([match('__root__', '/'), match('/problem/$id', '/problem/$id')]),
    ).toBe('/problem/[id]')
    expect(
      routePatternFromMatches([match('__root__', '/'), match('/rounds/$id', '/rounds/$id')]),
    ).toBe('/rounds/[id]')
    expect(
      routePatternFromMatches([
        match('__root__', '/'),
        match('/organizer', '/organizer'),
        match('/organizer/problems/$id/edit', '/organizer/problems/$id/edit'),
      ]),
    ).toBe('/organizer/problems/[id]/edit')
  })

  it('collapses a splat segment', () => {
    expect(routePatternFromMatches([match('__root__', '/'), match('/docs/$', '/docs/$')])).toBe(
      '/docs/[...splat]',
    )
  })

  it('reports /404 when no child route matched', () => {
    expect(routePatternFromMatches([])).toBe('/404')
    expect(routePatternFromMatches([match('__root__', '/')])).toBe('/404')
  })
})
