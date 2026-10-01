import { type BlockLocale, messagesFor, praticaSomaLista } from '@kumite/blocks'
import * as blocklyEn from 'blockly/msg/en'
import * as blocklyEs from 'blockly/msg/es'
import * as blocklyPt from 'blockly/msg/pt-br'
import { describe, expect, it } from 'vitest'

import { TOUR_STEPS } from '@/components/onboarding/tour-steps'
import en from './en.json'
import es from './es.json'
import pt from './pt.json'

/**
 * #393: the tour, the "How it works" page and the practice demos quote labels
 * that live elsewhere — the problem screen's buttons, the leaderboard tabs,
 * the header links, the kumite blocks and Blockly's own blocks. Each quote is
 * derived here from the real label, never typed by hand, so renaming a button
 * or upgrading Blockly fails this suite instead of leaving a script that
 * points at a label nobody sees any more.
 */

const CATALOGS = { pt, es, en } as const
const BLOCKLY_PACKS = { pt: blocklyPt, es: blocklyEs, en: blocklyEn } as const
const LOCALES = ['pt', 'es', 'en'] as const satisfies readonly BlockLocale[]

function text(locale: BlockLocale, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      CATALOGS[locale],
    )
  if (typeof value !== 'string') throw new Error(`${locale}: ${key} is not a string`)
  return value
}

/** A Blockly block label as the scripts quote it: `%1`, `%2`… replaced in
 * order, an empty argument dropped with its space ("set %1 to %2" → "set total
 * to"). */
function blocklyLabel(template: string, args: readonly string[]): string {
  return template
    .replace(/%(\d+)/g, (_match, index: string) => args[Number(index) - 1] ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The name the soma-lista reference solution gives a variable id — the
 * script names the same variable the demo canvas shows. */
function variableName(id: string): string {
  const variables = praticaSomaLista['variables'] as { id: string; name: string }[]
  const found = variables.find((variable) => variable.id === id)
  if (!found) throw new Error(`praticaSomaLista has no variable ${id}`)
  return found.name
}

const quoted = (label: string) => `"${label}"`

/** Every catalog key that quotes a label, and the labels it must contain. */
function requiredQuotes(locale: BlockLocale): Record<string, string[]> {
  const blocks = messagesFor(locale)
  const blockly = BLOCKLY_PACKS[locale]
  const total = variableName('varTotal')
  const numero = variableName('varNumero')
  const setTotal = quoted(blocklyLabel(blockly.VARIABLES_SET, [total, '']))

  return {
    'howItWorks.sections.editor.body': [
      quoted(blocks.solveTitle),
      quoted(blocks.solveReturn),
      text(locale, 'problem.executeButton'),
      text(locale, 'problem.submitButton'),
    ],
    'howItWorks.sections.teams.body': [text(locale, 'header.teamsLink')],
    'howItWorks.sections.practice.body': [text(locale, 'header.practiceLink')],
    'onboarding.tour.steps.editor.body': [
      quoted(blocks.solveTitle),
      text(locale, 'problem.executeButton'),
    ],
    'onboarding.tour.steps.leaderboard.body': [
      text(locale, 'leaderboard.tabs.round'),
      text(locale, 'leaderboard.tabs.event'),
    ],
    'practice.demo.steps.root': [quoted(blocks.solveTitle), quoted(blocks.solveReturn)],
    'practice.demo.steps.devolva-entrada.2': [
      quoted(blocks.inputTitle),
      blocks.categoryVariables,
      quoted(blocks.solveReturn),
    ],
    'practice.demo.steps.e-par.2': [blocks.categoryLogic, quoted(blocks.solveReturn)],
    'practice.demo.steps.e-par.3': [
      quoted(blocklyLabel(blockly.MATH_MODULO_TITLE, ['…', '…'])),
      blocks.categoryMath,
    ],
    'practice.demo.steps.e-par.4': [quoted(blocks.inputTitle)],
    'practice.demo.steps.soma-lista.2': [
      blocks.categoryVariables,
      quoted(blocks.categoryVariablesNew),
      quoted(total),
      setTotal,
    ],
    'practice.demo.steps.soma-lista.4': [
      blocks.categoryLoops,
      quoted(blocklyLabel(blockly.CONTROLS_FOREACH_TITLE, [numero, ''])),
      quoted(numero),
    ],
    'practice.demo.steps.soma-lista.5': [quoted(blocks.inputTitle)],
    'practice.demo.steps.soma-lista.6': [setTotal],
    'practice.demo.steps.soma-lista.7': [quoted(`${total} + ${numero}`)],
    'practice.demo.steps.soma-lista.8': [quoted(total), quoted(blocks.solveReturn)],
  }
}

describe.each(LOCALES)('copy that quotes a label (%s)', (locale) => {
  const lower = (label: string) => label.toLocaleLowerCase(locale)

  it.each(Object.entries(requiredQuotes(locale)))('%s quotes the real labels', (key, labels) => {
    const body = text(locale, key)
    for (const label of labels) expect(body).toContain(label)
  })

  it('names the tour steps after the header links they visit', () => {
    expect(text(locale, 'onboarding.tour.steps.teams.title')).toBe(text(locale, 'header.teamsLink'))
    expect(text(locale, 'onboarding.tour.steps.leaderboard.title')).toBe(
      text(locale, 'header.leaderboardLink'),
    )
    expect(text(locale, 'onboarding.tour.steps.practice.title')).toBe(
      text(locale, 'header.practiceLink'),
    )
  })

  it('lists the header links in the header step, in the header order', () => {
    const links = ['header.teamsLink', 'header.leaderboardLink', 'header.practiceLink']
    expect(text(locale, 'onboarding.tour.steps.header.body')).toContain(
      links.map((key) => lower(text(locale, key))).join(', '),
    )
  })

  // D6: the invite promises the places the tour then visits, in its order —
  // every step but the header, which is the menu the invite itself sits under.
  it('lists the tour stops in the invite, in the tour order', () => {
    const invite = text(locale, 'onboarding.invite.body')
    const positions = TOUR_STEPS.filter((step) => step.id !== 'header').map((step) => {
      const title = lower(text(locale, `onboarding.tour.steps.${step.id}.title`))
      const at = invite.indexOf(title)
      expect(at, `${step.id}: "${title}"`).toBeGreaterThanOrEqual(0)
      return at
    })
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })
})
