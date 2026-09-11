import type { ComponentPropsWithoutRef } from 'react'

import {
  LOCKUP_VIEW_BOX,
  LOCKUP_WORDMARK_PATH,
  LOCKUP_WORDMARK_TRANSFORM,
  MARK_PATH,
  MARK_ROTATION,
  MARK_STROKE_WIDTH,
} from './paths'

/**
 * Símbolo + wordmark lado a lado, como em `kumite-lockup-horizontal.svg`.
 *
 * Os blocos seguem a Regra 1 (vermelho à esquerda, `currentColor` à direita) e
 * o wordmark é o contorno PRÓPRIO do lockup — o avulso sairia com outro corpo.
 * Mínimo de 96 px de largura pela Regra 3; o header é a exceção documentada,
 * onde ele vai a ≈ 80 px.
 */
export function Lockup({ className, ...props }: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-testid="brand-lockup"
      fill="none"
      viewBox={LOCKUP_VIEW_BOX}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        className="fill-brand stroke-brand"
        d={MARK_PATH}
        strokeLinejoin="round"
        strokeWidth={MARK_STROKE_WIDTH}
      />
      <path
        d={MARK_PATH}
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={MARK_STROKE_WIDTH}
        transform={MARK_ROTATION}
      />
      <path d={LOCKUP_WORDMARK_PATH} fill="currentColor" transform={LOCKUP_WORDMARK_TRANSFORM} />
    </svg>
  )
}
