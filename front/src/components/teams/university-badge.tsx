import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type University = 'pucrs' | 'merida'

// `className` goes through `cn`, so a caller's size (the pódio projects the
// seal at ≥ 20px, #284) replaces the 11px default instead of fighting it.
export function UniversityBadge({
  university,
  className,
}: {
  university: University
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <Badge
      variant="outline"
      data-testid={`university-badge-${university}`}
      className={cn(
        'rounded-sm px-1.5 font-display text-[11px] font-semibold uppercase tracking-wide',
        className,
      )}
    >
      {t(`teams.university.${university}`)}
    </Badge>
  )
}
