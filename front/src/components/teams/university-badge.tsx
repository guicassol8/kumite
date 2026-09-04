import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

export type University = 'pucrs' | 'merida'

// The single flag↔university mapping in the front — the listing and the
// "my team" panel both render members through this component.
const FLAGS: Record<University, string> = {
  pucrs: '🇧🇷',
  merida: '🇲🇽',
}

export function UniversityBadge({ university }: { university: University }) {
  const { t } = useTranslation()

  return (
    <Badge variant="outline" data-testid={`university-badge-${university}`}>
      <span aria-hidden="true">{FLAGS[university]}</span>
      {t(`teams.university.${university}`)}
    </Badge>
  )
}
