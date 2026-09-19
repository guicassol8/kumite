import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from './alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'

afterEach(cleanup)

/** The element's classes as tokens — a substring match would hit `shadow-xs`. */
function classesOf(element: Element): string[] {
  return [...element.classList]
}

/**
 * `docs/design/identity.md` § 5: "Hairlines de 1 px, sem sombra além do anel de
 * foco". Both overlay primitives shipped with shadcn's `shadow-lg`; #233 takes
 * it out at the primitive, deliberately reaching every dialog in the app.
 */
describe('overlay primitives carry no drop shadow', () => {
  it('DialogContent has no shadow class', () => {
    render(
      <Dialog open>
        <DialogContent data-testid="dialog-under-test">
          <DialogTitle>Título</DialogTitle>
          <DialogDescription>Descrição</DialogDescription>
        </DialogContent>
      </Dialog>,
    )
    const classes = classesOf(screen.getByTestId('dialog-under-test'))
    expect(classes).not.toContain('shadow-lg')
    expect(classes.filter((token) => token.startsWith('shadow-'))).toEqual([])
  })

  it('AlertDialogContent has no shadow class', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent data-testid="alert-dialog-under-test">
          <AlertDialogTitle>Título</AlertDialogTitle>
          <AlertDialogDescription>Descrição</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    )
    const classes = classesOf(screen.getByTestId('alert-dialog-under-test'))
    expect(classes).not.toContain('shadow-lg')
    expect(classes.filter((token) => token.startsWith('shadow-'))).toEqual([])
  })
})

/**
 * The bug this pins shipped green once: `AlertDialogAction` used to hand the
 * caller's `className` to Radix's `Slot`, which only CONCATENATES the two class
 * strings. `bg-brand` then sat next to the variant's `bg-primary` and lost on
 * stylesheet order — "Abrir rodada" rendered in ink while a `classList`
 * assertion for `bg-brand` still passed. Asserting the *absence* of the
 * conflicting utility is what tells the two apart in jsdom, which has no
 * cascade: routed through `Button`, tailwind-merge drops `bg-primary`; on the
 * Slot it would still be there.
 */
describe('a caller className replaces the variant, never sits beside it', () => {
  it('AlertDialogAction drops the variant utility it conflicts with', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Título</AlertDialogTitle>
          <AlertDialogDescription>Descrição</AlertDialogDescription>
          <AlertDialogAction className="bg-brand">Abrir rodada</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    )
    const classes = classesOf(screen.getByRole('button', { name: 'Abrir rodada' }))
    expect(classes).toContain('bg-brand')
    expect(classes).not.toContain('bg-primary')
  })

  it('AlertDialogCancel does the same — the sibling that had the latent twin', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Título</AlertDialogTitle>
          <AlertDialogDescription>Descrição</AlertDialogDescription>
          <AlertDialogCancel className="bg-brand">Cancelar</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>,
    )
    const classes = classesOf(screen.getByRole('button', { name: 'Cancelar' }))
    expect(classes).toContain('bg-brand')
    expect(classes).not.toContain('bg-background')
  })
})
