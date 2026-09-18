import { createFileRoute } from '@tanstack/react-router'

import { OrganizerShell } from '@/components/organizer/panel-shell'
import { requireRole } from '@/lib/route-guards'

// The shell itself lives in `components/organizer/panel-shell.tsx`: a route
// file that exports anything besides `Route` opts out of the router plugin's
// `autoCodeSplitting`, which would ship the panel chrome to every visitor.
export const Route = createFileRoute('/organizer')({
  beforeLoad: requireRole('organizer'),
  component: OrganizerShell,
})
