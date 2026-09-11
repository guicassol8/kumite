import type { ComponentPropsWithoutRef } from 'react'

import { WORDMARK_PATH, WORDMARK_TRANSFORM, WORDMARK_VIEW_BOX } from './paths'

/**
 * O wordmark avulso, contornado (Regra 6: nunca recomposto com a fonte, nem
 * mesmo agora que a Barlow Condensed está no bundle — o contorno leva o
 * tracking de −1% que o texto vivo não tem).
 *
 * Módulo próprio de propósito: quem usa só o `Lockup` não carrega estes 8 KB
 * de path no bundle.
 */
export function Wordmark({ className, ...props }: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-testid="brand-wordmark"
      fill="none"
      viewBox={WORDMARK_VIEW_BOX}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d={WORDMARK_PATH} fill="currentColor" transform={WORDMARK_TRANSFORM} />
    </svg>
  )
}
