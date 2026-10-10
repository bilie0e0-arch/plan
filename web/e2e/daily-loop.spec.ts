import { expect, test } from '@playwright/test'
import { capture, signUp } from './helpers'

test('auth: username login, generic errors, protected routes', async ({ page }) => {
  const u = await signUp(page)
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Username').fill(u.username)
  await page.getByLabel('Password').fill('wrong-password-here')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Username or password is incorrect.')).toBeVisible()

  await page.getByLabel('Username').fill(u.username.toUpperCase())
  await page.getByLabel('Password').fill(u.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.context().clearCookies()
  await page.goto('/inbox')
  await expect(page).toHaveURL(/\/login$/)
})

test('daily loop: capture → plan → focus → shutdown', async ({ page }) => {
  await signUp(page)
  await expect(page.getByRole('region', { name: 'Now' })).toContainText('plan your day', { ignoreCase: true })

  // Capture with tokens
  await capture(page, 'Read chapter 3 ~25m !deep')
  await page.goto('/inbox')
  await expect(page.getByTestId('inbox-list')).toContainText('Read chapter 3')
  await expect(page.getByTestId('inbox-list')).toContainText('25m')

  // Morning ritual: check-in → yesterday → pick (first-action gate) → fit → start
  await page.goto('/plan')
  await page.getByRole('button', { name: /^4/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Add', exact: true }).first().click()
  await expect(page.getByText('What’s the first physical step?')).toBeVisible()
  await page.getByRole('button', { name: 'Plan it' }).click()
  await expect(page.getByText('1 / 7')).toBeVisible()
  await page.getByRole('button', { name: 'Check the fit' }).click()
  await page.getByRole('button', { name: 'Start day' }).click()
  await expect(page).toHaveURL(/\/$/)

  // Today shows the planned task with ▶; ⚙ offers the timer cards (Grow my focus = the ladder)
  await expect(page.getByText('Read chapter 3')).toBeVisible()
  await page.getByRole('button', { name: 'Timer options for Read chapter 3' }).click()
  await page.getByRole('radio', { name: /Grow my focus/ }).click()
  await page.getByPlaceholder('e.g. 3 pages read').fill('Finish section 3.1')
  await page.getByRole('button', { name: '▶ Start' }).click()

  // Focus mode: running → distraction → finish
  await expect(page).toHaveURL(/\/focus\?task=/)
  await expect(page.getByText('Got distracted')).toBeVisible({ timeout: 10_000 })
  await page.locator('body').press('d')
  await page.locator('body').press('i')
  await expect(page.getByLabel('1 distractions logged')).toBeVisible()
  await page.getByRole('button', { name: /I’m done/ }).click()
  // Under 2 minutes doesn't count toward skills
  await expect(page.getByText('Session discarded')).toBeVisible()
  await page.getByRole('button', { name: 'Back home' }).click()
  await expect(page).toHaveURL(/\/$/)

  // Shutdown: resolve leftover → done wall → close
  await page.goto('/shutdown')
  await page.getByRole('button', { name: 'Tomorrow' }).click()
  await page.getByRole('button', { name: 'See your day' }).click()
  await page.getByRole('button', { name: 'Close the day' }).click()
  await expect(page.getByRole('heading', { name: /Day closed/ })).toBeVisible()
})

test('isolation: one user cannot see another user’s tasks', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await signUp(a)
  await capture(a, 'Alice private task')
  await a.goto('/inbox')
  await expect(a.getByTestId('inbox-list')).toContainText('Alice private task')

  await signUp(b)
  await b.goto('/inbox')
  await expect(b.getByText('No ideas waiting.')).toBeVisible()
})
