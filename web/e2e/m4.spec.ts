import { expect, test, type Page } from '@playwright/test'
import { capture, signUp } from './helpers'

async function toToday(page: Page, title: string) {
  await page.goto('/inbox')
  const row = page.getByTestId('inbox-list').locator('li').filter({ hasText: title })
  await row.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(row).toBeHidden()
}

test('setup in four Enters sets kind, project, daily time and emphasis; settings keep essentials up top', async ({ page }) => {
  await signUp(page, undefined, { onboarding: 'keep' })
  await expect(page.getByText('What are you working on?')).toBeVisible()
  await page.keyboard.press('2') // Learning a skill
  await expect(page.getByRole('radio', { name: /Learning a skill/ })).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Enter')
  await page.getByLabel('Project name').fill('Spanish')
  await page.keyboard.press('Enter')
  await expect(page.getByText('How much time a day, roughly?')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByText('What do you want to get better at?')).toBeVisible()
  await page.getByRole('button', { name: /Speaking/ }).click()
  await page.keyboard.press('Enter')
  await expect(page.getByText('What do you want to get better at?')).toBeHidden()
  // Examples now match the kind of work
  await expect(page.getByRole('button', { name: /15-min practice drill/ })).toBeVisible()

  // Nothing is hidden: every section is still in the navigation
  await expect(page.locator('aside nav').getByRole('link')).toHaveText([/Today/, /Plan/, /Progress/, /Friends/])

  await page.goto('/settings')
  const areas = page.getByRole('group', { name: 'Areas to train' })
  await expect(areas.getByRole('button', { name: 'Speaking' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Advanced settings')).toBeVisible()
  await expect(page.getByText('Today limit')).toBeHidden()
  await page.getByText('Advanced settings').click()
  await expect(page.getByText('Today limit')).toBeVisible()
})

test('capture with a date hides the task until then; hide-until from the menu; Ctrl+K finds tasks', async ({ page }) => {
  await signUp(page)
  await capture(page, 'Call Sam tomorrow 3pm ~15m')
  await expect(page.getByText(/Captured — shows up/)).toBeVisible()
  await capture(page, 'Tidy desk')

  await page.goto('/inbox')
  const list = page.getByTestId('inbox-list')
  await expect(list).toContainText('Tidy desk')
  await expect(list).not.toContainText('Call Sam')
  await page.getByText('1 hidden until later').click()
  await expect(page.getByText(/^back /)).toBeVisible()

  await list.locator('li').filter({ hasText: 'Tidy desk' }).getByRole('button', { name: 'Task options' }).click()
  await page.getByRole('menuitem', { name: 'Hide until tomorrow' }).click()
  await expect(page.getByText('Hidden until tomorrow.')).toBeVisible()
  await expect(page.getByText('2 hidden until later')).toBeVisible()

  // Ctrl+K acts on tasks by name
  await page.locator('body').press('Control+k')
  await page.getByPlaceholder('Type a command or a task name…').fill('Tidy')
  await page.getByRole('option', { name: /Start: Tidy desk/ }).click()
  await expect(page).toHaveURL(/\/focus\?task=/)
})

test('run my Today list: sessions chain without going back home', async ({ page }) => {
  await signUp(page)
  await capture(page, 'First thing ~10m !admin')
  await capture(page, 'Second thing ~10m !admin')
  await toToday(page, 'First thing')
  await toToday(page, 'Second thing')

  await page.goto('/')
  await page.getByRole('link', { name: /Start my list/ }).click()
  await expect(page.getByText('Running your list · 1 of 2')).toBeVisible()
  await page.getByRole('button', { name: /Open timer/ }).click()
  await page.getByRole('button', { name: /^▶ Start/ }).click()
  await expect(page.getByText('Got distracted')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /I’m done/ }).click()
  await page.getByRole('button', { name: /Save · next: Second thing/ }).click()
  await expect(page.getByText('Running your list · 2 of 2')).toBeVisible()
})

test('balance: at most one highlighted main action on every main screen', async ({ page }) => {
  await signUp(page)
  await capture(page, 'Something to do')
  for (const path of ['/', '/inbox', '/projects', '/someday', '/aging', '/calendar', '/goals', '/commitments', '/speak', '/skills', '/review', '/habits', '/settings', '/plan', '/partner']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const primaries = await page.evaluate(() =>
      [...document.querySelectorAll('a, button')]
        .filter((e) => (e as HTMLElement).checkVisibility() && e.className.toString().split(/\s+/).includes('bg-primary'))
        .map((e) => (e.textContent ?? '').trim()))
    expect(primaries.length, `${path}: ${primaries.join(' | ')}`).toBeLessThanOrEqual(1)
  }
})
