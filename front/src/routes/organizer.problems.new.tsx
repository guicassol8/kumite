import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PANEL_FORM_HEADING } from '@/components/organizer/panel-form'
import { ProblemForm } from '@/components/organizer/problem-form'
import { api } from '@/lib/api'
import { readFieldIssues } from '@/lib/api-issues'
import {
  buildPatchBody,
  emptyProblemFormValues,
  issuesToProblemFormErrors,
  type ProblemFormError,
  type ProblemFormValues,
  type SubmitOutcome,
} from '@/lib/problem-form'

export const Route = createFileRoute('/organizer/problems/new')({
  component: NewProblemScreen,
})

const PROBLEMS_QUERY_KEY = ['organizer-problems']

function NewProblemScreen() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  // `POST /organizer/problems` only takes difficulty+points, so creating a
  // problem is a POST followed by a PATCH. Holding the created id means a
  // failed PATCH is retried on its own instead of orphaning another draft.
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [rootError, setRootError] = useState<string | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)

  type CreateOutcome = { ok: true; id: string } | { ok: false; fieldErrors: ProblemFormError[] }

  async function createAndPatch(values: ProblemFormValues): Promise<CreateOutcome> {
    let id = createdId
    if (!id) {
      const created = await api.organizer.problems.$post({
        json: { difficulty: values.difficulty, points: values.points },
      })
      if (created.status !== 201) {
        // This POST carries only difficulty and points, so it is the request
        // that refuses an over-the-ceiling score — and it sends no
        // translations, hence the empty array.
        return {
          ok: false,
          fieldErrors: issuesToProblemFormErrors(await readFieldIssues(created), []),
        }
      }
      id = (await created.json()).id
      setCreatedId(id)
    }

    const body = buildPatchBody(values)
    const patched = await api.organizer.problems[':id'].$patch({ param: { id }, json: body })
    if (patched.status !== 200) {
      return {
        ok: false,
        fieldErrors: issuesToProblemFormErrors(await readFieldIssues(patched), body.translations),
      }
    }
    return { ok: true, id }
  }

  /**
   * A save that failed with no mappable field keeps the form-level message it
   * always had — a 500, a dead connection, or a 422 whose paths this form has
   * no field for. That is the issue's fallback acceptance.
   */
  function saveFailure(fieldErrors: ProblemFormError[]): SubmitOutcome {
    if (fieldErrors.length === 0) setRootError(t('organizer.problemForm.errors.saveFailed'))
    return { ok: false, fieldErrors }
  }

  async function handleSave(values: ProblemFormValues): Promise<SubmitOutcome> {
    setIsSubmitting(true)
    setRootError(undefined)
    try {
      const outcome = await createAndPatch(values)
      if (!outcome.ok) return saveFailure(outcome.fieldErrors)

      queryClient.invalidateQueries({ queryKey: PROBLEMS_QUERY_KEY })
      navigate({ to: '/organizer/problems/$id/edit', params: { id: outcome.id } })
      return { ok: true }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePublish(values: ProblemFormValues): Promise<SubmitOutcome> {
    setIsSubmitting(true)
    setRootError(undefined)
    try {
      const outcome = await createAndPatch(values)
      if (!outcome.ok) return saveFailure(outcome.fieldErrors)

      const published = await api.organizer.problems[':id'].publish.$post({
        param: { id: outcome.id },
      })
      if (published.status !== 200) {
        // The back's 400/409 spell out what is missing only in `message`
        // (kata's envelope carries no structured issues here), so it is shown
        // verbatim; the client-side pre-validation is what points at a tab.
        const body = await published.json().catch(() => null)
        setRootError(body?.message ?? t('organizer.problemForm.errors.publishFailed'))
        return { ok: false, fieldErrors: [] }
      }

      queryClient.invalidateQueries({ queryKey: PROBLEMS_QUERY_KEY })
      navigate({ to: '/organizer/problems' })
      return { ok: true }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className={PANEL_FORM_HEADING}>{t('organizer.problemForm.createTitle')}</h2>
      <ProblemForm
        initialValues={emptyProblemFormValues()}
        savedLocales={[]}
        isSubmitting={isSubmitting}
        rootError={rootError}
        onSave={handleSave}
        onPublish={handlePublish}
      />
    </div>
  )
}
