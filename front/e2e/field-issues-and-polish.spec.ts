import { expect, type Page, type Route, test } from '@playwright/test'

import { EDITOR_TEST_TIMEOUT_MS, expectBlocklyInjected } from './support/blockly'
import {
  EDITOR_FIXTURE_TIMEOUT_MS,
  seedEditorFixture,
  seedParticipant,
  seedParticipantToken,
} from './support/editor-fixture'
import {
  BACK_URL,
  createRound,
  hasOrganizerCredentials,
  organizerAuthHeader,
  withNoOpenRound,
} from './support/rounds'

// Walkthrough for the grouped track #312 + #200 (PR #454).
//
// #312: the browser never reaches kata's 422 on its own — the client zod
// refuses the same values first — so every 422 here is forced with
// `page.route`, once with a body issue naming a field and once without, plus
// a dead network. The real back only renders the screens.
//
// #200: the closed-round hint beside Executar (.2), a refused Abrir landing
// under its own row (.3) and a team with no members (.4), all against real
// data. #200.1 (empty "Confirmar senha") shipped with #270 and is covered by
// its vitest.
const evidence312 = (name: string) => `e2e/evidence/312/${name}.png`
const evidence200 = (name: string) => `e2e/evidence/200/${name}.png`

const stamp = Date.now().toString().slice(-6)

/** kata's automatic validation envelope, with or without a body issue. */
function validationEnvelope(path?: string) {
  return {
    error: 'validation_failed',
    message: 'Invalid input',
    ...(path ? { issues: { body: [{ path, message: 'English zod text', code: 'custom' }] } } : {}),
  }
}

/** Answers every non-GET request to `url` with `answer`; GETs go through. */
async function stubMutations(
  page: Page,
  url: string,
  answer: (route: Route) => Promise<void>,
): Promise<void> {
  await page.unroute(url)
  await page.route(url, (route) =>
    route.request().method() === 'GET' ? route.continue() : answer(route),
  )
}

const fulfill422 = (path?: string) => (route: Route) =>
  route.fulfill({
    status: 422,
    contentType: 'application/json',
    body: JSON.stringify(validationEnvelope(path)),
  })
const abort = (route: Route) => route.abort('internetdisconnected')

async function signInAsOrganizer(page: Page): Promise<Record<string, string>> {
  const auth = await organizerAuthHeader()
  await seedParticipantToken(page, (auth.authorization ?? '').replace(/^Bearer /, ''))
  return auth
}

test.describe('#312 — the 422 envelope goes through readFieldIssues', () => {
  test('cadastro: issue sob o campo, 422 sem issue e rede caída', async ({ page }) => {
    const signupUrl = `${BACK_URL}/auth/signup`
    await page.goto('/signup')
    await page.getByTestId('signup-name-input').fill('Revisão 312')
    await page.getByTestId('signup-email-input').fill(`review-312-${stamp}@edu.pucrs.br`)
    await page.getByTestId('signup-password-input').fill('supersecret')
    await page.getByTestId('signup-confirm-password-input').fill('supersecret')
    await page.getByTestId('signup-code-input').fill('PUCRS2026')

    await stubMutations(page, signupUrl, fulfill422('email'))
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('signup-email-error')).toHaveText('Valor inválido')
    await expect(page.getByText('English zod text')).toHaveCount(0)
    await expect(page.getByTestId('signup-form-error')).toHaveCount(0)
    await page.screenshot({ path: evidence312('01-signup-422-campo'), fullPage: true })

    await stubMutations(page, signupUrl, fulfill422())
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('signup-form-error')).toContainText(
      'Não foi possível concluir o cadastro',
    )
    await page.screenshot({ path: evidence312('02-signup-422-sem-issue'), fullPage: true })

    await stubMutations(page, signupUrl, abort)
    await page.getByTestId('signup-email-input').fill(`review-312-net-${stamp}@edu.pucrs.br`)
    await page.getByTestId('signup-submit-button').click()
    await expect(page.getByTestId('signup-form-error')).toContainText(
      'Não foi possível concluir o cadastro',
    )
    await page.screenshot({ path: evidence312('03-signup-rede'), fullPage: true })
  })

  test.describe('organizador', () => {
    test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

    test('edição de rodada: issue sob o campo, 422 sem issue e rede caída', async ({ page }) => {
      const auth = await signInAsOrganizer(page)
      const roundId = await createRound(auth, {
        name: `Rodada 312 ${stamp}`,
        durationMinutes: 30,
        problemIds: [],
      })
      const patchUrl = `${BACK_URL}/organizer/rounds/${roundId}`
      await page.goto(`/organizer/rounds/${roundId}/edit`)
      await expect(page.getByTestId('round-form')).toBeVisible()

      await stubMutations(page, patchUrl, fulfill422('name'))
      await page.getByTestId('round-form-save').click()
      await expect(page.getByTestId('round-form-name-error')).toHaveText(
        'O servidor recusou este valor. Revise o campo.',
      )
      await expect(page.getByTestId('round-form-error')).toHaveCount(0)
      await page.screenshot({ path: evidence312('04-rodada-422-nome'), fullPage: true })

      await stubMutations(page, patchUrl, fulfill422('problemIds[0]'))
      await page.getByTestId('round-form-save').click()
      await expect(page.getByTestId('round-form-problems-error')).toHaveText(
        'Um ou mais problemas selecionados são inválidos.',
      )
      await expect(page.getByTestId('round-form-name-error')).toHaveCount(0)
      await page.screenshot({ path: evidence312('05-rodada-422-problemas'), fullPage: true })

      await stubMutations(page, patchUrl, fulfill422())
      await page.getByTestId('round-form-save').click()
      await expect(page.getByTestId('round-form-error')).toContainText(
        'Não foi possível salvar a rodada',
      )
      await expect(page.getByTestId('round-form-problems-error')).toHaveCount(0)
      await page.screenshot({ path: evidence312('06-rodada-422-sem-issue'), fullPage: true })

      await stubMutations(page, patchUrl, abort)
      await page.getByTestId('round-form-save').click()
      await expect(page.getByTestId('round-form-error')).toContainText(
        'Não foi possível salvar a rodada',
      )
      await expect(page.getByTestId('round-form-save')).toBeEnabled()
      await page.screenshot({ path: evidence312('07-rodada-rede'), fullPage: true })
    })

    test('mistura de universidades: 422 no mixingLocked, 422 sem issue e rede', async ({
      page,
    }) => {
      await signInAsOrganizer(page)
      const configUrl = `${BACK_URL}/organizer/event-config`
      await page.goto('/organizer/event-config')
      const toggle = async () => {
        await page.getByTestId('event-config-mixing-switch').click()
        await page.getByTestId('event-config-mixing-confirm-confirm').click()
      }

      await stubMutations(page, configUrl, fulfill422('mixingLocked'))
      await toggle()
      await expect(page.getByTestId('event-config-mixing-error')).toHaveText(
        'O servidor recusou este valor. Revise o campo.',
      )
      await page.screenshot({ path: evidence312('08-mistura-422-campo'), fullPage: true })

      await stubMutations(page, configUrl, fulfill422())
      await toggle()
      await expect(page.getByTestId('event-config-mixing-error')).toHaveText(
        'Não foi possível salvar. Tente novamente.',
      )
      await page.screenshot({ path: evidence312('09-mistura-422-sem-issue'), fullPage: true })

      await stubMutations(page, configUrl, abort)
      await toggle()
      await expect(page.getByTestId('event-config-mixing-error')).toHaveText(
        'Não foi possível salvar. Tente novamente.',
      )
      await page.screenshot({ path: evidence312('10-mistura-rede'), fullPage: true })
    })
  })
})

test.describe('#200 — acabamento', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  test.describe('aviso do Executar em rodada encerrada (#200.2)', () => {
    test.describe.configure({ timeout: EDITOR_TEST_TIMEOUT_MS })

    let problemId: string
    let participantToken: string

    test.beforeAll(async () => {
      test.setTimeout(EDITOR_FIXTURE_TIMEOUT_MS)
      ;({ problemId, participantToken } = await seedEditorFixture('Run Hint 200'))
    })

    for (const [label, size, shot] of [
      ['desktop', { width: 1280, height: 800 }, '01-executar-aviso-desktop'],
      ['390 px', { width: 390, height: 844 }, '02-executar-aviso-390'],
    ] as const) {
      test(`o aviso fica junto do Executar — ${label}`, async ({ page }) => {
        await page.setViewportSize(size)
        await seedParticipantToken(page, participantToken)
        await page.goto(`/problem/${problemId}`)
        await expectBlocklyInjected(page)

        const hint = page.getByTestId('problem-run-closed-hint')
        await expect(hint).toHaveText(
          'Rodada encerrada: executar só testa os exemplos e não vale pontos.',
        )
        await expect(page.getByTestId('problem-submit-button')).toHaveCount(0)
        const hintId = await hint.getAttribute('id')
        expect(hintId).toBeTruthy()
        await expect(page.getByTestId('problem-run-button')).toHaveAttribute(
          'aria-describedby',
          hintId ?? '',
        )
        await page.getByTestId('problem-actions-bar').scrollIntoViewIfNeeded()
        await page.screenshot({ path: evidence200(shot), fullPage: true })
      })
    }
  })

  for (const [label, size, shot] of [
    ['desktop', { width: 1280, height: 800 }, '03-abrir-sem-problemas-desktop'],
    ['390 px', { width: 390, height: 844 }, '04-abrir-sem-problemas-390'],
  ] as const) {
    test(`abrir rodada sem problemas: o erro fica na linha (#200.3) — ${label}`, async ({
      page,
    }) => {
      await page.setViewportSize(size)
      const auth = await signInAsOrganizer(page)
      const roundId = await createRound(auth, {
        name: `Sem problemas 200 ${stamp} ${label}`,
        durationMinutes: 30,
        problemIds: [],
      })

      await withNoOpenRound(auth, async () => {
        await page.goto('/organizer/rounds')
        await page.getByTestId(`organizer-rounds-open-${roundId}`).click()
        await page.getByTestId('organizer-rounds-open-confirm').click()

        const error = page.getByTestId(`organizer-rounds-action-error-${roundId}`)
        await expect(error).toHaveText('Adicione ao menos um problema antes de abrir a rodada.')
        await expect(page.getByTestId(`organizer-rounds-row-${roundId}`)).toContainText(
          'Adicione ao menos um problema',
        )
        await expect(page.getByTestId('organizer-rounds-action-error')).toHaveCount(0)
        await error.scrollIntoViewIfNeeded()
        await page.screenshot({ path: evidence200(shot) })
      })
    })
  }

  test('time sem integrantes mostra estado vazio (#200.4)', async ({ page }) => {
    const owner = await seedParticipant('empty-team-200')
    const teamName = `Time Vazio ${stamp}`
    const created = await fetch(`${BACK_URL}/teams`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({ name: teamName }),
    })
    const { id: teamId } = (await created.json()) as { id: string }
    const left = await fetch(`${BACK_URL}/teams/leave`, {
      method: 'POST',
      headers: { authorization: `Bearer ${owner.token}` },
    })
    expect(left.ok).toBe(true)

    await signInAsOrganizer(page)
    await page.goto('/organizer/teams')
    const card = page.getByTestId(`team-moderation-card-${teamId}`)
    await expect(card).toContainText(teamName)
    await expect(page.getByTestId(`team-moderation-members-empty-${teamId}`)).toHaveText(
      'Este time não tem integrantes.',
    )
    await expect(page.getByTestId(`team-moderation-members-${teamId}`)).toHaveCount(0)
    await expect(page.getByTestId(`team-moderation-member-count-${teamId}`)).toHaveText('0')
    await card.scrollIntoViewIfNeeded()
    await card.screenshot({ path: evidence200('05-time-sem-integrantes') })
  })
})
