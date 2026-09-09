import { expect, type Page } from '@playwright/test'

// Creating a team through the UI, without assuming how full the `teams` table
// happens to be (#150).
//
// The screen offers two buttons for the same dialog: `teams-create-open` in the
// heading, and `teams-empty-cta` inside the empty state — and when the table is
// empty BOTH are on the page at once (`teams.tsx`, both gated only by
// `canCreate`). A spec naming one of them by hand is guessing at a state it
// does not control, so this takes whichever comes first and leaves the choice
// to the screen.
//
// Playwright only collects `*.spec.ts` under `testDir`, so this is a helper,
// not a suite.

/** Creates a team from the /teams screen and waits for the panel to show up. */
export async function createTeamThroughUi(page: Page, name: string): Promise<void> {
  const openDialog = page
    .getByTestId('teams-create-open')
    .or(page.getByTestId('teams-empty-cta'))
    .first()

  await expect(openDialog).toBeVisible()
  await openDialog.click()

  await page.getByTestId('teams-create-name-input').fill(name)
  await page.getByTestId('teams-create-submit').click()
  await expect(page.getByTestId('my-team-panel')).toBeVisible()
}
