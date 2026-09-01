import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ProblemForm } from '@/components/organizer/problem-form'
import { api } from '@/lib/api'
import { buildPatchBody, emptyProblemFormValues, type ProblemFormValues } from '@/lib/problem-form'

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

  async function createAndPatch(values: ProblemFormValues): Promise<string | null> {
    let id = createdId
    if (!id) {
      const created = await api.organizer.problems.$post({
        json: { difficulty: values.difficulty, points: values.points },
      })
      if (created.status !== 201) return null
      id = (await created.json()).id
      setCreatedId(id)
    }

    const patched = await api.organizer.problems[':id'].$patch({
      param: { id },
      json: buildPatchBody(values),
    })
    return patched.status === 200 ? id : null
  }

  async function handleSave(values: ProblemFormValues) {
    setIsSubmitting(true)
    setRootError(undefined)
    try {
      const id = await createAndPatch(values)
      if (!id) {
        setRootError(t('organizer.problemForm.errors.saveFailed'))
        return
      }
      queryClient.invalidateQueries({ queryKey: PROBLEMS_QUERY_KEY })
      navigate({ to: '/organizer/problems/$id/edit', params: { id } })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePublish(values: ProblemFormValues) {
    setIsSubmitting(true)
    setRootError(undefined)
    try {
      const id = await createAndPatch(values)
      if (!id) {
        setRootError(t('organizer.problemForm.errors.saveFailed'))
        return
      }

      const published = await api.organizer.problems[':id'].publish.$post({ param: { id } })
      if (published.status !== 200) {
        // The back's 400/409 spell out what is missing only in `message`
        // (kata's envelope carries no structured issues here), so it is shown
        // verbatim; the client-side pre-validation is what points at a tab.
        const body = await published.json().catch(() => null)
        setRootError(body?.message ?? t('organizer.problemForm.errors.publishFailed'))
        return
      }

      queryClient.invalidateQueries({ queryKey: PROBLEMS_QUERY_KEY })
      navigate({ to: '/organizer/problems' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold text-xl">{t('organizer.problemForm.createTitle')}</h2>
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
