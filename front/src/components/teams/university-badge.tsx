import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

export type University = 'pucrs' | 'merida'

export function UniversityBadge({ university }: { university: University }) {
  const { t } = useTranslation()

  return (
    <Badge
      variant="outline"
      data-testid={`university-badge-${university}`}
      className="rounded-sm px-1.5 font-display text-[11px] font-semibold uppercase tracking-wide"
    >
      {t(`teams.university.${university}`)}
    </Badge>
  )
}
