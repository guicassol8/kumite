import { createFileRoute } from '@tanstack/react-router'

import { ProblemScreen } from '@/components/problem/problem-screen'
import { requireAuth } from '@/lib/route-guards'

export const Route = createFileRoute('/problem/$id')({
  beforeLoad: requireAuth,
  component: RoundProblemRoute,
})

function RoundProblemRoute() {
  const { id } = Route.useParams()
  return <ProblemScreen id={id} mode="round" />
}
