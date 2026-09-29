/**
 * The guided tour's script (#213): the real screens, in order, and what to
 * point at on each. The tour never calls a write endpoint — it only navigates
 * and highlights — so every target is a `data-testid` that already exists on
 * that screen.
 *
 * `targets` is a preference list: the first one present *and* visible wins,
 * which is how a step survives the screen's own states (the leaderboard with
 * or without rounds) and layouts (the problem screen's editor panel is
 * `problem-workspace-panel` when stacked below md, the resizable Panel whose
 * auto-testid is `editor` from md up). None found within the wait → the
 * popover opens centered and the tour goes on.
 */

export type TourStaticPath = '/' | '/teams' | '/leaderboard' | '/practice'

export type TourDestination =
  | { kind: 'path'; to: TourStaticPath }
  // The first problem of the practice catalog, or `fallback` when there is
  // none (or it failed to load).
  | { kind: 'first-practice-problem'; fallback: { to: TourStaticPath; targets: string[] } }

export type TourStepId = 'header' | 'round' | 'teams' | 'editor' | 'leaderboard' | 'practice'

export type TourStep = {
  id: TourStepId
  destination: TourDestination
  targets: string[]
}

export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'header', destination: { kind: 'path', to: '/' }, targets: ['language-selector'] },
  { id: 'round', destination: { kind: 'path', to: '/' }, targets: ['home-round-card'] },
  { id: 'teams', destination: { kind: 'path', to: '/teams' }, targets: ['teams-heading'] },
  {
    id: 'editor',
    destination: {
      kind: 'first-practice-problem',
      fallback: { to: '/practice', targets: ['practice-empty', 'practice-list'] },
    },
    targets: ['problem-workspace-panel', 'editor', 'blockly-workspace'],
  },
  {
    id: 'leaderboard',
    destination: { kind: 'path', to: '/leaderboard' },
    targets: ['leaderboard-tabs', 'leaderboard-empty-no-round', 'leaderboard-empty'],
  },
  {
    id: 'practice',
    destination: { kind: 'path', to: '/practice' },
    targets: ['practice-list', 'practice-empty'],
  },
]

/** i18n keys for a step's popover — one title and one body per step. */
export function tourStepKeys(id: TourStepId) {
  return {
    title: `onboarding.tour.steps.${id}.title`,
    body: `onboarding.tour.steps.${id}.body`,
  } as const
}
