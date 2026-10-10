import { expect, test } from '@playwright/test'
import { capture, signUp } from './helpers'

test('weekly review: wrapped → outcomes → mission → commit week', async ({ page }) => {
  await signUp(page)
  await page.goto('/review')
  await expect(page.getByRole('heading', { name: 'Weekly review' })).toBeVisible()

  // Week Wrapped: story cards, ends on "Plan next week"
  await expect(page.getByText('Your week in one number', { exact: false })).toBeVisible()
  for (let i = 0; i < 10; i++) {
    const done = page.getByRole('button', { name: 'Plan next week →' })
    if (await done.isVisible()) { await done.click(); break }
    await page.getByRole('button', { name: 'Next', exact: true }).click()
  }

  // Outcomes
  await expect(page.getByText('This week’s 3 outcomes')).toBeVisible()
  await page.getByLabel('Outcome 1').fill('Chapter 3 drafted')
  await page.getByRole('button', { name: 'Save outcomes' }).click()
  await expect(page.getByText('Outcomes saved.')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click() // → goals
  await page.getByRole('button', { name: 'Next', exact: true }).click() // → mission result
  await page.getByRole('button', { name: 'Next', exact: true }).click() // → skills & mission

  // Choose the main mission (the weekly drill)
  const estimation = page.locator('li').filter({ hasText: 'Guess the time 10 times' })
  await estimation.getByRole('button', { name: 'Main' }).click()
  await expect(page.getByText('This week: Guess the time 10 times')).toBeVisible()

  // Progress persists across reloads
  await page.reload()
  await expect(page.getByText('5. Skills & mission')).toBeVisible()
  await expect(estimation.getByRole('button', { name: 'Main' })).toHaveAttribute('aria-pressed', 'true')

  for (const label of ['Clean up', 'Commitments', 'Plan', 'Lock in my week']) {
    await page.getByRole('button', { name: /^(Next|Skip for now)$/ }).click()
    await expect(page.getByText(new RegExp(`^\\d\\. ${label}$`))).toBeVisible()
  }
  await page.getByRole('button', { name: 'Lock in my week', exact: true }).click()
  await expect(page.getByText(/^Week locked in/)).toBeVisible()

  // Reopening the review shows it as done
  await page.goto('/review')
  await expect(page.getByText(/^Week locked in/)).toBeVisible()
})

test('habits, if-then cue, aging queue and kill list', async ({ page }) => {
  await signUp(page)

  // Habit: add → log today → consistency shows, no streak
  await page.goto('/habits')
  await page.getByLabel('New habit').fill('Read 10 min')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Read 10 min')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Read 10 min done today' }).click()
  await expect(page.getByText('100%')).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Habits.*1 of 1 today/ })).toBeVisible() // Today shows habits as a tile

  // If-then cue + definition of done on a task
  await capture(page, 'Draft intro ~20m')
  await page.goto('/inbox')
  await page.getByRole('button', { name: 'Task options' }).first().click()
  await page.getByRole('menuitem', { name: 'Edit…' }).click()
  await page.getByLabel('Done when…').fill('intro sent to Sam')
  await page.getByLabel('If-then cue').fill('If I finish lunch, I open the draft')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()

  // Kill from the menu → appears on the kill list → restore
  await page.getByRole('button', { name: 'Task options' }).first().click()
  await page.getByRole('menuitem', { name: /Let it go/ }).click()
  await page.goto('/aging')
  await expect(page.getByText('All tidy.')).toBeVisible()
  await page.getByRole('link', { name: 'Let go' }).click()
  await expect(page.getByText('Draft intro')).toBeVisible()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('Restored to backlog.')).toBeVisible()
})

test('navigation: four sections, section tabs, account menu', async ({ page }) => {
  await signUp(page)
  const sidebar = page.locator('aside nav')
  await expect(sidebar.getByRole('link')).toHaveText([/Today/, /Plan/, /Progress/, /Friends/])

  await sidebar.getByRole('link', { name: /Plan/ }).click()
  await expect(page).toHaveURL(/\/calendar$/)
  const tabs = page.getByRole('navigation', { name: 'Plan' })
  await expect(tabs.getByRole('link')).toHaveText(['Calendar', 'Goals', 'Lists', 'My promises'])
  await tabs.getByRole('link', { name: 'Goals' }).click()
  await expect(page).toHaveURL(/\/goals$/)
  await expect(sidebar.getByRole('link', { name: /Plan/ })).toHaveAttribute('aria-current', 'page')

  await sidebar.getByRole('link', { name: /Progress/ }).click()
  await page.getByRole('navigation', { name: 'Progress' }).getByRole('link', { name: 'Habits' }).click()
  await expect(page.getByRole('heading', { name: /Habits/ })).toBeVisible()

  // Shortcuts still reach pages directly
  await page.locator('body').press('g')
  await page.locator('body').press('i')
  await expect(page).toHaveURL(/\/inbox$/)

  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)
})
