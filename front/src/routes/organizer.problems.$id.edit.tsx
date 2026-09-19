import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PANEL_FORM_HEADING } from '@/components/organizer/panel-form'
import { ProblemForm } from '@/components/organizer/problem-form'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { readFieldIssues } from '@/lib/api-issues'
import {
  buildPatchBody,
  issuesToProblemFormErrors,
  type ProblemFormError,
  type ProblemFormValues,
  problemDetailToFormValues,
  type SubmitOutcome,
  savedLocalesOf,
} from '@/lib/problem-form'

export const Route = createFileRoute('/organizer/problems/$id/edit')({
  component: EditProblemScreen,
})

const PROBLEMS_QUERY_KEY = ['organizer-problems']

class ProblemNotFoundError extends Error {}

async function fetchProblem(id: string) {
  const res = await api.organizer.problems[':id'].$get({ param: { id } })
  // 422 alongside 404, cast included (#94) — see fetchProblem in
  // lib/problems-query.ts. Only this read: the PATCH below keeps its own 404
  // handling, because a 422 there means the submitted body is wrong, not that
  // the problem is gone.
  if (res.status === 404 || (res.status as number) === 422) throw new ProblemNotFoundError()
  if (res.status !== 200) throw new Error('failed to load problem')
  return res.json()
}

function EditProblemScreen() {
  const { t } = useTranslation()
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const [rootError, setRootError] = useState<string | undefined>(undefined)
  const [successMessage, setSuccessMessage] = useState<string | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const problem = useQuery({
    queryKey: ['organizer-problem', id],
    queryFn: () => fetchProblem(id),
    retry: false,
    // This is an authoring screen: a background refetch while the organizer
    // is writing would overwrite the fetched detail under an unsaved form.
    refetchOnWindowFocus: false,
  })

  type PatchOutcome = { ok: true } | { ok: false; fieldErrors: ProblemFormError[] }

  async function patch(values: ProblemFormValues): Promise<PatchOutcome> {
    const body = buildPatchBody(values)
    const res = await api.organizer.problems[':id'].$patch({ param: { id }, json: body })
    if (res.status === 200) return { ok: true }
    // The translations actually sent are what a `translations[i].*` path indexes
    // into — buildPatchBody drops the incomplete locales.
    return {
      ok: false,
      fieldErrors: issuesToProblemFormErrors(await readFieldIssues(res), body.translations),
    }
  }

  /**
   * No mappable field means the failure keeps the form-level message it always
   * had: a 500, a dead connection, or a 422 on a path with no field here.
   */
  function saveFailure(fieldErrors: ProblemFormError[]): SubmitOutcome {
    if (fieldErrors.length === 0) setRootError(t('organizer.problemForm.errors.saveFailed'))
    return { ok: false, fieldErrors }
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['organizer-problem', id] })
    queryClient.invalidateQueries({ queryKey: PROBLEMS_QUERY_KEY })
  }

  async function handleSave(values: ProblemFormValues): Promise<SubmitOutcome> {
    setIsSubmitting(true)
    setRootError(undefined)
    setSuccessMessage(undefined)
    try {
      const outcome = await patch(values)
      if (!outcome.ok) return saveFailure(outcome.fieldErrors)

      // PATCH never touches `status`, so a published problem stays published;
      // the screen stays put so the organizer can keep editing.
      invalidate()
      setSuccessMessage(t('organizer.problemForm.savedMessage'))
      return { ok: true }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePublish(values: ProblemFormValues): Promise<SubmitOutcome> {
    setIsSubmitting(true)
    setRootError(undefined)
    setSuccessMessage(undefined)
    try {
      const outcome = await patch(values)
      if (!outcome.ok) return saveFailure(outcome.fieldErrors)

      const published = await api.organizer.problems[':id'].publish.$post({ param: { id } })
      if (published.status !== 200) {
        // The 400/409 bodies name what is missing only in `message`; the
        // client-side pre-validation is what points at a tab or a field.
        const body = await published.json().catch(() => null)
        setRootError(body?.message ?? t('organizer.problemForm.errors.publishFailed'))
        return { ok: false, fieldErrors: [] }
      }

      invalidate()
      navigate({ to: '/organizer/problems' })
      return { ok: true }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className={PANEL_FORM_HEADING}>{t('organizer.problemForm.editTitle')}</h2>

      {problem.isPending && (
        <p data-testid="problem-form-loading">{t('organizer.problemForm.loading')}</p>
      )}

      {problem.isError &&
        (problem.error instanceof ProblemNotFoundError ? (
          <div data-testid="problem-form-not-found" className="flex flex-col items-start gap-2">
            <p>{t('organizer.problemForm.errors.notFound')}</p>
            <Link to="/organizer/problems" className="text-primary text-sm underline">
              {t('organizer.problemForm.backToList')}
            </Link>
          </div>
        ) : (
          <div data-testid="problem-form-load-error" className="flex flex-col items-start gap-2">
            <p>{t('organizer.problemForm.errors.loadFailed')}</p>
            <Button
              type="button"
              variant="outline"
              data-testid="problem-form-load-retry"
              onClick={() => problem.refetch()}
            >
              {t('organizer.problemForm.errors.retry')}
            </Button>
          </div>
        ))}

      {problem.data && (
        <ProblemForm
          // Seeded once per problem: keyed on the fetched detail instead, a
          // refetch that returns the very same body would still remount the
          // form and throw away whatever the organizer had typed.
          key={id}
          initialValues={problemDetailToFormValues(problem.data)}
          savedLocales={savedLocalesOf(problem.data)}
          status={problem.data.status}
          isSubmitting={isSubmitting}
          rootError={rootError}
          successMessage={successMessage}
          onSave={handleSave}
          onPublish={handlePublish}
        />
      )}
    </div>
  )
}
