import { createFileRoute } from '@tanstack/react-router'

import { ProblemScreen } from '@/components/problem/problem-screen'
import { requireAuth } from '@/lib/route-guards'

// The practice problem (#211): the same screen as /problem/$id, in practice
// mode — editor, statement, examples and Executar, nothing of a round.
export const Route = createFileRoute('/practice/$id')({
  beforeLoad: requireAuth,
  component: PracticeProblemRoute,
})

function PracticeProblemRoute() {
  const { id } = Route.useParams()
  return <ProblemScreen id={id} mode="practice" />
}
