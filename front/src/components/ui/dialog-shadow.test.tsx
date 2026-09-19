import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  AlertDialog,
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
