import { PANEL_EYEBROW } from './panel-table'

// Shared by the overview route and its live card (#279), so both read as one
// screen.

// The "stat" role from the identity's type scale: 44px display, tabular so a
// number changing under SSE does not shift the card's width.
export const STAT = 'font-bold font-display text-[44px] leading-none tabular-nums'
export const CARD_TITLE = `${PANEL_EYEBROW} text-muted-foreground`
export const DETAIL = 'text-muted-foreground text-sm'
