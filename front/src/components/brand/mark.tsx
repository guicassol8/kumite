import type { ComponentPropsWithoutRef } from 'react'

import { MARK_PATH, MARK_ROTATION, MARK_STROKE_WIDTH } from './paths'

/**
 * O símbolo: dois blocos com um vão no meio, na grade de 64.
 *
 * Regra 1 de `docs/design/logo/README.md`: o vermelho é SEMPRE o bloco da
 * esquerda; o da direita usa a cor do texto do fundo, e por isso sai em
 * `currentColor` — no chrome carvão da #217 ele vira papel sozinho, sem
 * variante nem prop.
 *
 * Sai `aria-hidden`: quem nomeia é o elemento pai (o link do header já tem
 * seu `aria-label` traduzido), e um SVG rotulado ali duplicaria o nome.
 */
export function Mark({ className, ...props }: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-testid="brand-mark"
      fill="none"
      viewBox="0 0 64 64"
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
    </svg>
  )
}
