import { expect, type Page, type Route, test } from '@playwright/test'
import { seedParticipant, seedParticipantToken } from './support/editor-fixture'
import { BACK_URL, hasOrganizerCredentials, organizerAuthHeader } from './support/rounds'

// #195 — four mutations used to fail in silence (findings #26–#29 of the
// 2026-09-10 bug hunt). Every failure here is forced with `page.route`, so
// the real back is only there to seed fixtures and to render the screens:
// a frozen team, a dead network and a 500 cannot be produced on demand.
//
// Each test also collects `pageerror`: an unhandled rejection is exactly what
// the un-awaited `mutateAsync` calls used to leave behind, and it is invisible
// on screen.
const evidence = (name: string) => `e2e/evidence/195/${name}.png`

// Short enough to keep the moderation cards readable in the screenshots.
const stamp = Date.now().toString().slice(-6)

function collectPageErrors(page: Page): Error[] {
  const errors: Error[] = []
  page.on('pageerror', (error) => errors.push(error))
  return errors
}

async function createTeam(token: string, name: string): Promise<string> {
  const res = await fetch(`${BACK_URL}/teams`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  })
  const { id } = (await res.json()) as { id?: string }
  if (!id) throw new Error(`could not create team "${name}" (HTTP ${res.status})`)
  return id
}

async function joinTeam(token: string, teamId: string): Promise<void> {
  const res = await fetch(`${BACK_URL}/teams/${teamId}/join`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
  if (res.status !== 200) throw new Error(`could not join team ${teamId} (HTTP ${res.status})`)
}

/** Aborts every non-GET request to `url` — the network dying mid-click. */
async function abortMutations(page: Page, url: string): Promise<void> {
  await page.route(url, (route: Route) =>
    route.request().method() === 'GET' ? route.continue() : route.abort('internetdisconnected'),
  )
}

test('#26 — leaving a team says why it failed: frozen team, then a dead network', async ({
  page,
}) => {
  const errors = collectPageErrors(page)
  const participant = await seedParticipant('leave-195')
  await createTeam(participant.token, `Leave Frozen ${stamp}`)
  await seedParticipantToken(page, participant.token)

  // The listing still says "not frozen" (it went stale), so the button is
  // enabled and the API is the one that refuses.
  const leaveUrl = `${BACK_URL}/teams/leave`
  await page.route(leaveUrl, (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'team_frozen',
        message: 'This team has already submitted — contact the organizer to leave',
      }),
    }),
  )
  await page.goto('/teams')
  await page.getByTestId('my-team-leave').click()
  await page.getByTestId('teams-leave-confirm').click()
  await expect(page.getByTestId('teams-action-error')).toContainText('formação está congelada')
  await expect(page.getByTestId('my-team-panel')).toBeVisible()
  await page.screenshot({ path: evidence('01-leave-team-frozen'), fullPage: true })

  await page.unroute(leaveUrl)
  await abortMutations(page, leaveUrl)
  await page.getByTestId('my-team-leave').click()
  await page.getByTestId('teams-leave-confirm').click()
  await expect(page.getByTestId('teams-action-error')).toContainText(
    'Não foi possível sair do time',
  )
  await expect(page.getByTestId('my-team-panel')).toBeVisible()
  await page.screenshot({ path: evidence('02-leave-network'), fullPage: true })

  expect(errors).toEqual([])
})

test('#29 — a dead network on reset step 2 says so, keeps the fields and lets a retry through', async ({
  page,
}) => {
  const errors = collectPageErrors(page)
  const email = `reset-195-${stamp}@edu.pucrs.br`

  // Step 1 is stubbed: this test is about step 2, and a real request would
  // spend the per-email budget of the rate limiter for nothing.
  await page.route(`${BACK_URL}/auth/request-password-reset`, (route) =>
    route.fulfill({ status: 204 }),
  )
  const completeUrl = `${BACK_URL}/auth/complete-password-reset`
  await abortMutations(page, completeUrl)

  await page.goto('/reset-password')
  await page.getByTestId('reset-password-request-email-input').fill(email)
  await page.getByTestId('reset-password-request-submit').click()
  await expect(page.getByTestId('reset-password-request-sent')).toBeVisible()

  await page.getByTestId('reset-password-otp-input').fill('123456')
  await page.getByTestId('reset-password-new-password-input').fill('brandnewpassword')
  await page.getByTestId('reset-password-confirm-password-input').fill('brandnewpassword')
  await page.getByTestId('reset-password-submit-button').click()

  const formError = page.getByTestId('reset-password-form-error')
  await expect(formError).toContainText('Não foi possível redefinir a senha')
  await expect(formError).not.toContainText('Código inválido')
  await expect(page.getByTestId('reset-password-otp-input')).toHaveValue('123456')
  await expect(page.getByTestId('reset-password-email-input')).toHaveValue(email)
  await page.screenshot({ path: evidence('08-reset-step2-network-fields-kept'), fullPage: true })

  // The network is back: the same code goes out again with one click.
  await page.unroute(completeUrl)
  let retriedOtp: string | undefined
  await page.route(completeUrl, (route) => {
    retriedOtp = (route.request().postDataJSON() as { otp?: string }).otp
    return route.fulfill({ status: 204 })
  })
  await page.getByTestId('reset-password-submit-button').click()
  await expect(page.getByTestId('reset-password-success')).toBeVisible()
  expect(retriedOtp).toBe('123456')

  expect(errors).toEqual([])
})

test.describe('organizer mutations', () => {
  test.skip(!hasOrganizerCredentials, 'ORGANIZER_EMAIL/ORGANIZER_PASSWORD not set')

  async function signInAsOrganizer(page: Page): Promise<Record<string, string>> {
    const auth = await organizerAuthHeader()
    await seedParticipantToken(page, (auth.authorization ?? '').replace(/^Bearer /, ''))
    return auth
  }

  test('#27 — every team moderation action reports a dead network', async ({ page }) => {
    // Four actions, four screenshots, one screen.
    test.slow()
    const errors = collectPageErrors(page)

    const owner = await seedParticipant('mod-owner-195')
    const member = await seedParticipant('mod-member-195')
    const destOwner = await seedParticipant('mod-dest-195')
    const teamName = `Silent Squad ${stamp}`
    const destName = `Landing ${stamp}`
    const teamId = await createTeam(owner.token, teamName)
    await joinTeam(member.token, teamId)
    await createTeam(destOwner.token, destName)

    await signInAsOrganizer(page)
    await abortMutations(page, `${BACK_URL}/organizer/teams/${teamId}`)
    await abortMutations(page, `${BACK_URL}/organizer/teams/members/${member.id}`)
    await abortMutations(page, `${BACK_URL}/organizer/teams/members/${member.id}/move`)
    await page.goto('/organizer/teams')
    const card = page.getByTestId(`team-moderation-card-${teamId}`)
    await expect(card).toBeVisible()

    // 03 — rename.
    await page.getByTestId(`team-moderation-rename-start-${teamId}`).click()
    await page.getByTestId(`team-moderation-rename-input-${teamId}`).fill(`Renamed ${stamp}`)
    await page.getByTestId(`team-moderation-rename-save-${teamId}`).click()
    await expect(page.getByTestId(`team-moderation-rename-error-${teamId}`)).toContainText(
      'Não foi possível salvar',
    )
    await card.scrollIntoViewIfNeeded()
    await page.screenshot({ path: evidence('03-rename-network'), fullPage: true })
    await page.getByTestId(`team-moderation-rename-cancel-${teamId}`).click()

    // 04 — move.
    await page.getByTestId(`team-moderation-move-select-${member.id}`).click()
    await page.getByRole('option', { name: destName }).click()
    await page.getByTestId(`team-moderation-move-action-${member.id}`).click()
    await expect(page.getByTestId(`team-moderation-move-error-${member.id}`)).toContainText(
      'Não foi possível mover este integrante',
    )
    await expect(card.getByTestId(`team-moderation-member-row-${member.id}`)).toBeVisible()
    await page.screenshot({ path: evidence('04-move-network'), fullPage: true })

    // 05 — remove member.
    await page.getByTestId(`team-moderation-remove-member-action-${member.id}`).click()
    await page.getByTestId(`team-moderation-remove-member-confirm-confirm-${member.id}`).click()
    await expect(
      page.getByTestId(`team-moderation-remove-member-error-${member.id}`),
    ).toContainText('Não foi possível remover este integrante')
    await expect(card.getByTestId(`team-moderation-member-row-${member.id}`)).toBeVisible()
    await page.screenshot({ path: evidence('05-remove-member-network'), fullPage: true })

    // 06 — remove team.
    await page.getByTestId(`team-moderation-remove-team-action-${teamId}`).click()
    await page.getByTestId(`team-moderation-remove-team-confirm-confirm-${teamId}`).click()
    await expect(page.getByTestId(`team-moderation-remove-team-error-${teamId}`)).toContainText(
      'Não foi possível remover este time',
    )
    await expect(card).toBeVisible()
    await page.screenshot({ path: evidence('06-remove-team-network'), fullPage: true })

    expect(errors).toEqual([])
  })

  test('#28 — a failed archive keeps the dialog open with the error', async ({ page }) => {
    const errors = collectPageErrors(page)
    const auth = await signInAsOrganizer(page)

    const created = await fetch(`${BACK_URL}/organizer/problems`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ difficulty: 'easy', points: 10 }),
    })
    const { id } = (await created.json()) as { id: string }
    await fetch(`${BACK_URL}/organizer/problems/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({
        translations: [{ locale: 'pt', title: `Arquivo ${stamp}`, statementMd: 'Nada.' }],
      }),
    })

    await page.route(`${BACK_URL}/organizer/problems/${id}/archive`, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal_error', message: 'boom' }),
      }),
    )
    await page.goto('/organizer/problems')
    await page.getByTestId(`organizer-problems-archive-${id}`).click()
    await page.getByTestId('organizer-problems-archive-confirm').click()

    await expect(page.getByTestId('organizer-problems-archive-dialog')).toBeVisible()
    await expect(page.getByTestId('organizer-problems-archive-error')).toContainText(
      'Não foi possível arquivar o problema',
    )
    await expect(page.getByTestId(`organizer-problems-archive-${id}`)).toBeVisible()
    // Viewport-only: the modal's fixed backdrop does not stretch over a
    // full-page stitch, which left half the list looking un-dimmed.
    await page.screenshot({ path: evidence('07-archive-failed-dialog-open') })

    expect(errors).toEqual([])
  })
})
