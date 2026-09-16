import { readFileSync } from 'node:fs'

import { expect, type Page, test } from '@playwright/test'

const back = `http://localhost:${process.env.PORT ?? '3000'}`
const evidence = (name: string) => `e2e/evidence/221/${name}.png`

async function controls(page: Page) {
  const main = page.locator('main')
  await expect(main.locator('input').first()).toBeVisible()
  for (const control of await main.locator('input, button, [data-slot="button"]').all()) {
    if (await control.isVisible()) {
      expect((await control.boundingBox())?.height).toBe(44)
    }
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
}

async function signup(page: Page) {
  const email = `identity-${Date.now()}-${Math.random().toString(36).slice(2)}@edu.pucrs.br`
  await page.goto('/signup')
  await page.getByTestId('signup-name-input').fill('Identity Participant')
  await page.getByTestId('signup-email-input').fill(email)
  await page.getByTestId('signup-password-input').fill('originalpassword')
  await page.getByTestId('signup-confirm-password-input').fill('originalpassword')
  await page.getByTestId('signup-code-input').fill('PUCRS2026')
  await page.getByTestId('signup-submit-button').click()
  await expect(page.getByTestId('header-user-email')).toHaveText('Identity Participant')
  return email
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test.describe(`${viewport.width}px authentication forms`, () => {
    test.use({ viewport })

    test('login, signup and both reset steps have 44px controls and no overflow', async ({
      page,
    }) => {
      for (const route of ['login', 'signup', 'reset-password']) {
        await page.goto(`/${route}`)
        await controls(page)
        if (route === 'login')
          await expect(page.getByTestId('login-poster')).toBeVisible({
            visible: viewport.width >= 1024,
          })
        await page.screenshot({ path: evidence(`${viewport.width}-${route}`), fullPage: true })
      }
      await page
        .getByTestId('reset-password-request-email-input')
        .fill(`unknown-${Date.now()}@edu.pucrs.br`)
      await page.getByTestId('reset-password-request-submit').click()
      await expect(page.getByTestId('reset-password-request-sent')).toBeVisible()
      await controls(page)
      await page.screenshot({ path: evidence(`${viewport.width}-reset-complete`), fullPage: true })
    })

    test('voluntary and mandatory password changes have 44px controls', async ({
      page,
      request,
    }) => {
      test.skip(
        !process.env.ORGANIZER_EMAIL || !process.env.ORGANIZER_PASSWORD,
        'Organizer credentials required for temporary-password flow',
      )
      await signup(page)
      await page.goto('/change-password')
      await controls(page)
      await page.getByTestId('change-password-submit-button').click()
      await expect(page.getByTestId('change-password-current-error')).toBeVisible()
      await expect(page.getByTestId('change-password-current-input')).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      const invalid = await page
        .getByTestId('change-password-current-input')
        .evaluate((element) => {
          const probe = document.createElement('span')
          probe.style.color = 'var(--destructive)'
          document.body.append(probe)
          const crimson = getComputedStyle(probe).color
          probe.remove()
          return { border: getComputedStyle(element).borderColor, crimson }
        })
      expect(invalid.border).toBe(invalid.crimson)
      await expect(page.getByTestId('change-password-back-link')).toBeVisible()
      await page.screenshot({
        path: evidence(`${viewport.width}-change-voluntary`),
        fullPage: true,
      })
      const token = await page.evaluate(() => localStorage.getItem('kumite-token'))
      const me = await request.get(`${back}/me`, { headers: { Authorization: `Bearer ${token}` } })
      const { id } = await me.json()
      const organizerLogin = await request.post(`${back}/auth/login`, {
        data: { email: process.env.ORGANIZER_EMAIL, password: process.env.ORGANIZER_PASSWORD },
      })
      expect(organizerLogin.status()).toBe(200)
      const organizer = await organizerLogin.json()
      const reset = await request.post(`${back}/organizer/users/${id}/reset-password`, {
        headers: { Authorization: `Bearer ${organizer.token}` },
        data: { adminPassword: process.env.ORGANIZER_PASSWORD },
      })
      expect(reset.status()).toBe(200)
      await page.reload()
      await expect(page.getByTestId('change-password-required-notice')).toBeVisible()
      await expect(page.getByTestId('change-password-back-link')).toHaveCount(0)
      await controls(page)
      await page.screenshot({ path: evidence(`${viewport.width}-change-required`), fullPage: true })
    })
  })
}

test('poster appears at 1024px and stays hidden at 1023px', async ({ page }) => {
  await page.goto('/login')
  for (const width of [1023, 1024]) {
    await page.setViewportSize({ width, height: 800 })
    await expect(page.getByTestId('login-poster')).toBeVisible({ visible: width === 1024 })
    await controls(page)
  }
})

for (const theme of ['light', 'dark']) {
  test(`${theme} validation uses crimson outlines and keyboard focus`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('kumite:theme', value), theme)
    await page.setViewportSize({ width: 390, height: 844 })
    for (const [route, submit, input, error] of [
      ['login', 'login-submit-button', 'login-password-input', 'login-password-error'],
      [
        'signup',
        'signup-submit-button',
        'signup-confirm-password-input',
        'signup-confirm-password-error',
      ],
      [
        'reset-password',
        'reset-password-request-submit',
        'reset-password-request-email-input',
        'reset-password-request-email-error',
      ],
    ] as const) {
      await page.goto(`/${route}`)
      await page.getByTestId(submit).click()
      const field = page.getByTestId(input)
      await expect(field).toHaveAttribute('aria-invalid', 'true')
      await expect(page.getByTestId(error)).toBeVisible()
      const appearance = await field.evaluate((element) => {
        const style = getComputedStyle(element)
        const probe = document.createElement('span')
        probe.style.color = 'var(--destructive)'
        document.body.append(probe)
        const crimson = getComputedStyle(probe).color
        probe.remove()
        return { border: style.borderColor, background: style.backgroundColor, crimson }
      })
      expect(appearance.border).toBe(appearance.crimson)
      expect(appearance.background).not.toBe(appearance.crimson)
      const box = await field.boundingBox()
      const message = await page.getByTestId(error).boundingBox()
      expect(message?.y).toBeGreaterThanOrEqual((box?.y ?? 0) + (box?.height ?? 0))
      await page.screenshot({ path: evidence(`${theme}-${route}-validation`), fullPage: true })
    }
    await page.goto('/login')
    await page.getByTestId('login-password-input').focus()
    await page.keyboard.press('Tab')
    const toggle = page.getByTestId('login-password-input-toggle')
    await expect(toggle).toBeFocused()
    expect(await toggle.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none')
    const focus = await toggle.evaluate((element) => {
      const style = getComputedStyle(element)
      const probe = document.createElement('span')
      probe.style.color = 'var(--ring)'
      document.body.append(probe)
      const ring = getComputedStyle(probe).color
      probe.remove()
      return { borderWidth: style.borderTopWidth, borderColor: style.borderTopColor, ring }
    })
    expect(focus.borderWidth).toBe('1px')
    expect(focus.borderColor).toBe(focus.ring)
    await page.screenshot({ path: evidence(`${theme}-password-focus`), fullPage: true })
    await page.getByTestId('login-email-input').fill(`unknown-${Date.now()}@edu.pucrs.br`)
    await page.getByTestId('login-password-input').fill('wrong-password')
    await page.getByTestId('login-submit-button').click()
    const alert = page.getByTestId('login-form-error')
    await expect(alert).toBeVisible()
    await expect(page.getByTestId('login-submit-button')).toBeEnabled()
    await expect(alert.locator('svg')).toBeVisible()
    const colors = await alert.evaluate((element) => ({
      border: getComputedStyle(element).borderColor,
      text: getComputedStyle(element).color,
      background: getComputedStyle(element).backgroundColor,
    }))
    expect(colors.border).toBe(colors.text)
    expect(colors.background).not.toBe(colors.text)
    await page.screenshot({ path: evidence(`${theme}-credentials-error`), fullPage: true })
  })
}

for (const [language, title, support] of [
  ['pt', 'Programação em blocos', 'Monte a solução com blocos'],
  ['es', 'Programación en bloques', 'Construye la solución con bloques'],
  ['en', 'Block programming', 'Build your solution with blocks'],
] as const) {
  test(`${language} poster and authentication links preserve redirect`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('kumite-lang', value), language)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/login?redirect=%2Fteams')
    await expect(page.getByTestId('login-poster')).toContainText(title)
    await expect(page.getByTestId('login-poster')).toContainText(support)
    await page.getByTestId('login-signup-link').click()
    await expect(page).toHaveURL(/\/signup\?redirect=%2Fteams/)
    await page.getByTestId('signup-login-link').click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fteams/)
  })
}

test('reset success keeps the same form composition', async ({ page }) => {
  test.skip(!process.env.BACK_NOTIFICATIONS_LOG, 'BACK_NOTIFICATIONS_LOG required for real OTP')
  const email = await signup(page)
  await page.getByTestId('header-logout-button').click()
  await page.goto('/reset-password')
  await page.getByTestId('reset-password-request-email-input').fill(email)
  await page.getByTestId('reset-password-request-submit').click()
  await expect(page.getByTestId('reset-password-request-sent')).toBeVisible()
  let otp = ''
  await expect
    .poll(() => {
      const line = readFileSync(process.env.BACK_NOTIFICATIONS_LOG ?? '', 'utf8')
        .split('\n')
        .reverse()
        .find((line) => line.includes('[notifications]') && line.includes(email))
      otp = line?.match(/: (\d{6})$/)?.[1] ?? ''
      return otp.length
    })
    .toBe(6)
  await page.getByTestId('reset-password-otp-input').fill(otp)
  await page.getByTestId('reset-password-new-password-input').fill('brandnewpassword')
  await page.getByTestId('reset-password-confirm-password-input').fill('brandnewpassword')
  await page.getByTestId('reset-password-submit-button').click()
  await expect(page.getByTestId('reset-password-success')).toBeVisible()
  expect((await page.getByTestId('reset-password-login-link').boundingBox())?.height).toBe(44)
  await page.screenshot({ path: evidence('reset-success'), fullPage: true })
})
