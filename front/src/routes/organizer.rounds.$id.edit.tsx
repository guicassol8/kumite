import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PANEL_FORM_HEADING } from '@/components/organizer/panel-form'
import { RoundForm, type RoundFormValues } from '@/components/organizer/round-form'
import { api } from '@/lib/api'

export const Route = createFileRoute('/organizer/rounds/$id/edit')({
  component: EditRoundScreen,
})

const ROUNDS_QUERY_KEY = ['organizer-rounds']

class RoundNotFoundError extends Error {}

async function fetchRound(id: string) {
  const res = await api.organizer.rounds[':id'].$get({ param: { id } })
  // 422 alongside 404, cast included (#94) — see fetchProblem in
  // lib/problems-query.ts. Only this read: the PATCH below keeps its own 404
  // handling, because a 422 there means the submitted body is wrong, not that
  // the round is gone.
  if (res.status === 404 || (res.status as number) === 422) throw new RoundNotFoundError()
  if (res.status !== 200) throw new Error('failed to load round')
  return res.json()
}

function roundToFormValues(round: {
  name: string
  durationMinutes: number
  problems: { problemId: string; position: number }[]
}): RoundFormValues {
  return {
    name: round.name,
    durationMinutes: round.durationMinutes,
    problemIds: [...round.problems].sort((a, b) => a.position - b.position).map((p) => p.problemId),
  }
}

function EditRoundScreen() {
  const { t } = useTranslation()
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const [rootError, setRootError] = useState<string | undefined>(undefined)
  const [successMessage, setSuccessMessage] = useState<string | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const round = useQuery({
    queryKey: ['organizer-round', id],
    queryFn: () => fetchRound(id),
    retry: false,
    refetchOnWindowFocus: false,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['organizer-round', id] })
    queryClient.invalidateQueries({ queryKey: ROUNDS_QUERY_KEY })
  }

  async function handleSave(values: RoundFormValues) {
    setIsSubmitting(true)
    setRootError(undefined)
    setSuccessMessage(undefined)
    try {
      const res = await api.organizer.rounds[':id'].$patch({ param: { id }, json: values })
      if (res.status !== 200) {
        if (res.status === 400) {
          const body = await res.json().catch(() => null)
          if (body?.error === 'invalid_problem_ids') {
            setRootError(t('organizer.roundForm.errors.invalidProblemIds'))
            return
          }
        }
        if (res.status === 404) {
          setRootError(t('organizer.roundForm.errors.notFound'))
          return
        }
        if (res.status === 409) {
          const body = await res.json().catch(() => null)
          if (body?.error === 'round_not_draft') {
            setRootError(t('organizer.roundForm.errors.roundNotDraft'))
            invalidate()
            return
          }
        }
        setRootError(t('organizer.roundForm.errors.saveFailed'))
        return
      }

      invalidate()
      setSuccessMessage(t('organizer.roundForm.savedMessage'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className={PANEL_FORM_HEADING}>{t('organizer.roundForm.editTitle')}</h2>

      {round.isPending && (
        <p data-testid="round-form-loading">{t('organizer.roundForm.loading')}</p>
      )}

      {round.isError &&
        (round.error instanceof RoundNotFoundError ? (
          <div data-testid="round-form-not-found" className="flex flex-col items-start gap-2">
            <p>{t('organizer.roundForm.errors.notFound')}</p>
            <Link to="/organizer/rounds" className="text-primary text-sm underline">
              {t('organizer.roundForm.backToList')}
            </Link>
          </div>
        ) : (
          <div data-testid="round-form-load-error" className="flex flex-col items-start gap-2">
            <p>{t('organizer.roundForm.errors.saveFailed')}</p>
          </div>
        ))}

      {round.data &&
        (round.data.status !== 'draft' ? (
          <div data-testid="round-form-not-draft" className="flex flex-col items-start gap-2">
            <p>{t('organizer.roundForm.notDraft.title')}</p>
            <Link to="/organizer/rounds" className="text-primary text-sm underline">
              {t('organizer.roundForm.notDraft.backToList')}
            </Link>
          </div>
        ) : (
          <RoundForm
            key={id}
            initialValues={roundToFormValues(round.data)}
            isSubmitting={isSubmitting}
            rootError={rootError}
            onSave={handleSave}
          />
        ))}

      {successMessage && (
        <p data-testid="round-form-success" className="text-sm">
          {successMessage}
        </p>
      )}
    </div>
  )
}
