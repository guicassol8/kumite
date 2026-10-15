import { readdirSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ROUTE_FILE_IGNORE_PATTERN } from './route-file-ignore'

// Compiled exactly as @tanstack/router-generator does it
// (filesystem/physical/getRouteNodes): a global RegExp, matched against the
// bare file name — not the path (#328).
function isIgnored(name: string): boolean {
  return name.match(new RegExp(ROUTE_FILE_IGNORE_PATTERN, 'g')) !== null
}

const routesDir = path.resolve(import.meta.dirname, '../routes')
const files = readdirSync(routesDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
const testFiles = files.filter((name) => /\.test\.tsx?$/.test(name))
const routeFiles = files.filter((name) => !/\.test\.tsx?$/.test(name))

describe('ROUTE_FILE_IGNORE_PATTERN (#328)', () => {
  it('finds both route files and test files under src/routes', () => {
    expect(testFiles.length).toBeGreaterThan(0)
    expect(routeFiles.length).toBeGreaterThan(0)
  })

  it('ignores every test file that lives next to its route', () => {
    expect(testFiles.filter((name) => !isIgnored(name))).toEqual([])
  })

  it('ignores no real route, so a route without `Route` still warns', () => {
    expect(routeFiles).toEqual(
      expect.arrayContaining(['__root.tsx', 'problem.$id.tsx', 'leaderboard_.podium.tsx']),
    )
    expect(routeFiles.filter(isIgnored)).toEqual([])
  })

  it('matches .test.ts as well as .test.tsx, and nothing that merely contains "test"', () => {
    expect(isIgnored('organizer.rounds.$id.edit.test.tsx')).toBe(true)
    expect(isIgnored('helpers.test.ts')).toBe(true)
    expect(isIgnored('contest.tsx')).toBe(false)
    expect(isIgnored('test.tsx')).toBe(false)
    expect(isIgnored('latest.test-results.tsx')).toBe(false)
  })
})
