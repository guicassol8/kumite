import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { requireRole } from '@/lib/route-guards'

export const Route = createFileRoute('/organizer')({
  beforeLoad: requireRole('organizer'),
  component: OrganizerScreen,
})

// The 2px underline lives on the ITEM, never on the <nav>: below
// `size.breakpoint-cards` (768px) the tabs wrap onto two lines (identity § 5),
// and a border on the container would draw one line under the whole bar
// instead of under the active tab. On the item it follows the tab to whichever
// row it wrapped onto.
// The active/inactive split has to go through `activeProps`/`inactiveProps`,
// not through one base class plus an override: TanStack *appends*
// `activeProps.className`, it does not run it through tailwind-merge, so a
// `border-transparent` in the base and a `border-brand` in `activeProps` both
// survive into the attribute and the winner is whichever Tailwind emitted
// last in the stylesheet — `border-transparent`, as the browser test caught.
const TAB_CLASS = 'border-b-2 pb-2 font-medium text-sm'
const TAB_ACTIVE_CLASS = 'border-brand text-foreground'
const TAB_INACTIVE_CLASS = 'border-transparent text-muted-foreground'

// Exported for `organizer.test.tsx`, which mounts the shell on a minimal route
// tree (the `header.test.tsx` recipe) instead of `routeTree.gen` — the real
// tree would drag every organizer child screen and its queries into a test
// that only asserts the chrome.
export function OrganizerScreen() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1120px] flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <h1
        className="font-bold font-display text-4xl uppercase leading-none tracking-[0.01em]"
        data-testid="organizer-heading"
      >
        {t('organizer.heading')}
      </h1>
      <nav
        aria-label={t('organizer.nav.ariaLabel')}
        className="flex flex-wrap gap-x-6 gap-y-2 border-border border-b"
      >
        <Link
          to="/organizer"
          data-testid="organizer-nav-overview"
          // Without `exact`, the index link stays active on every child
          // route, since they all sit under /organizer.
          activeOptions={{ exact: true }}
          activeProps={{ className: TAB_ACTIVE_CLASS }}
          inactiveProps={{ className: TAB_INACTIVE_CLASS }}
          className={TAB_CLASS}
        >
          {t('organizer.nav.overview')}
        </Link>
        <Link
          to="/organizer/problems"
          data-testid="organizer-nav-problems"
          activeProps={{ className: TAB_ACTIVE_CLASS }}
          inactiveProps={{ className: TAB_INACTIVE_CLASS }}
          className={TAB_CLASS}
        >
          {t('organizer.nav.problems')}
        </Link>
        <Link
          to="/organizer/rounds"
          data-testid="organizer-nav-rounds"
          activeProps={{ className: TAB_ACTIVE_CLASS }}
          inactiveProps={{ className: TAB_INACTIVE_CLASS }}
          className={TAB_CLASS}
        >
          {t('organizer.nav.rounds')}
        </Link>
        <Link
          to="/organizer/event-config"
          data-testid="organizer-nav-event-config"
          activeProps={{ className: TAB_ACTIVE_CLASS }}
          inactiveProps={{ className: TAB_INACTIVE_CLASS }}
          className={TAB_CLASS}
        >
          {t('organizer.nav.eventConfig')}
        </Link>
        <Link
          to="/organizer/teams"
          data-testid="organizer-nav-teams"
          activeProps={{ className: TAB_ACTIVE_CLASS }}
          inactiveProps={{ className: TAB_INACTIVE_CLASS }}
          className={TAB_CLASS}
        >
          {t('organizer.nav.teams')}
        </Link>
        <Link
          to="/organizer/users"
          data-testid="organizer-nav-users"
          activeProps={{ className: TAB_ACTIVE_CLASS }}
          inactiveProps={{ className: TAB_INACTIVE_CLASS }}
          className={TAB_CLASS}
        >
          {t('organizer.nav.users')}
        </Link>
      </nav>
      <Outlet />
    </main>
  )
}
