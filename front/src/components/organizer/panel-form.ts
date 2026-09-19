/**
 * Class strings shared by the organizer panel's *write* surfaces — the problem,
 * round and event-rule forms, and every panel overlay (#233).
 *
 * Deliberately a plain module with no JSX and no route: exporting constants
 * from a TanStack route file breaks its code-splitting, a mistake the #298
 * review already caught once.
 *
 * Read surfaces (shell, overview, tables) belong to #223 and keep their own
 * constants in `panel-table.tsx`; `PANEL_SECTION_TITLE` reuses the eyebrow from
 * there so the string exists in exactly one place.
 */
import { PANEL_EYEBROW } from './panel-table'

/** Screen heading of the four form routes — same H2 as the restyled listings. */
export const PANEL_FORM_HEADING = 'font-display font-semibold text-2xl uppercase tracking-[0.01em]'

/** Section heading inside a form ("Casos de teste", "Problemas"). */
export const PANEL_SECTION_TITLE = `${PANEL_EYEBROW} text-muted-foreground`

/**
 * Field label: 13/500 Barlow, lower case.
 * `docs/design/canvas/generate/common.py:105` (`.label`) — not the eyebrow,
 * which is 13/600 Condensed upper case and is reserved for table headers.
 */
export const PANEL_FIELD_LABEL = 'text-[13px] font-medium text-foreground'

/**
 * Per-field error: crimson text at 13 px, 4 px under the control.
 * `docs/design/canvas/generate/identity.py:91`. The crimson *outline* comes for
 * free from `aria-invalid:border-destructive` on the primitives — there is no
 * red fill to remove, and none to add.
 */
export const PANEL_FIELD_ERROR = 'text-[13px] text-destructive'

/**
 * JetBrains Mono 13/20 for editable JSON, test-case values and event codes
 * (`docs/design/identity.md` § 4).
 *
 * `md:text-[13px]` is not redundant: `ui/input.tsx` and `ui/textarea.tsx` both
 * carry `md:text-sm`, and tailwind-merge does not drop a `md:` utility because
 * of an unprefixed one — without this the fields measured 14 px from the
 * breakpoint up, which the browser acceptance run caught.
 */
export const PANEL_MONO = 'font-mono text-[13px] leading-5 md:text-[13px]'

/**
 * The single `--brand`-filled button of a screen (§ 3, Regra 2): "Publicar" on
 * the problem form, "Abrir rodada" inside its confirmation dialog. Same string
 * the problem screen already uses in `components/problem/actions-bar.tsx`.
 */
export const PANEL_BRAND_BUTTON = 'bg-brand text-brand-foreground shadow-none hover:bg-brand-hover'

/** Dialog title as an H2, matching the participant dialogs restyled by #222. */
export const PANEL_DIALOG_TITLE = 'font-display font-semibold text-2xl'

/**
 * Segmented control (`common.py:118`, `.seg`) for the form's pt/es/en tabs —
 * not the underlined tabs, which are the panel navigation sitting right above.
 */
export const PANEL_SEG_LIST = 'border border-border bg-background-2'
export const PANEL_SEG_TRIGGER = 'text-[13px] data-[state=active]:bg-card'
