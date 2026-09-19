import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PANEL_FORM_HEADING } from '@/components/organizer/panel-form'
import { RoundForm, type RoundFormValues } from '@/components/organizer/round-form'
import { api } from '@/lib/api'

export const Route = createFileRoute('/organizer/rounds/new')({
  component: NewRoundScreen,
})

const ROUNDS_QUERY_KEY = ['organizer-rounds']

function emptyRoundFormValues(): RoundFormValues {
  return { name: '', durationMinutes: 30, problemIds: [] }
}

function NewRoundScreen() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const [rootError, setRootError] = useState<string | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSave(values: RoundFormValues) {
    setIsSubmitting(true)
    setRootError(undefined)
    try {
      const res = await api.organizer.rounds.$post({ json: values })
      if (res.status !== 201) {
        if (res.status === 400) {
          const body = await res.json().catch(() => null)
          if (body?.error === 'invalid_problem_ids') {
            setRootError(t('organizer.roundForm.errors.invalidProblemIds'))
            return
          }
        }
        setRootError(t('organizer.roundForm.errors.saveFailed'))
        return
      }

      queryClient.invalidateQueries({ queryKey: ROUNDS_QUERY_KEY })
      navigate({ to: '/organizer/rounds' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className={PANEL_FORM_HEADING}>{t('organizer.roundForm.createTitle')}</h2>
      <RoundForm
        initialValues={emptyRoundFormValues()}
        isSubmitting={isSubmitting}
        rootError={rootError}
        onSave={handleSave}
      />
    </div>
  )
}
