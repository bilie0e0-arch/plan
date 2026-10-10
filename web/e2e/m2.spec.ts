import { expect, test } from '@playwright/test'
import { signUp } from './helpers'

function tomorrowKey(): string {
  const d = new Date(Date.now() + 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).format(d)
}

test('goal → place on calendar → commit week → launcher → focus', async ({ page }) => {
  await signUp(page)

  // WOOP goal wizard
  await page.goto('/goals/new')
  await page.getByLabel('Goal').fill('Write weekly')
  await page.getByRole('button', { name: /Habit/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Done looks like').fill('4 hours of writing every week')
  await page.getByLabel('Done looks like').press('Enter') // Enter moves on
  await page.getByLabel('Obstacle').fill('I scroll my phone first')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('If-then plan').fill('If I reach for my phone, I put it in another room')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Activate goal' }).click()
  await expect(page).toHaveURL(/\/calendar$/)

  // Place the goal's hours: pick the chip, tap tomorrow 09:00
  await page.getByRole('button', { name: /Write weekly/ }).first().click()
  await page.getByRole('button', { name: `${tomorrowKey()} 09:00` }).click()
  const block = page.locator('[data-block-id]').filter({ hasText: 'Write weekly' }).first()
  await expect(block).toBeVisible()

  // Commit the week → original plan frozen
  await page.getByRole('button', { name: 'Lock in my week' }).click()
  await expect(page.getByText('Week locked in ✓')).toBeVisible()
  await page.goto('/commitments')
  await expect(page.getByRole('heading', { name: /My promises/ })).toBeVisible()

  // Block Launcher → setup → start → focus mode linked to the block
  await page.goto('/calendar')
  const id = await page.locator('[data-block-id]').filter({ hasText: 'Write weekly' }).first().getAttribute('data-block-id')
  await page.goto(`/launch/${id}`)
  await expect(page.getByText('Serves: Write weekly')).toBeVisible()
  await page.getByRole('button', { name: 'Water nearby' }).click()
  await page.getByRole('button', { name: /I’m ready — start/ }).click()
  await expect(page.getByText('Got distracted')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /I’m done/ }).click()
  await expect(page.getByText('Session discarded')).toBeVisible()
})

test('speaking drill: record → listen → self-rate → reveal → save', async ({ page }) => {
  await signUp(page)
  await page.goto('/speak/drill?type=explain')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: /record now/ }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: 'Stop' }).click()

  // Listen-back gate: rating stays locked until the take has been heard
  const reveal = page.getByRole('button', { name: 'Reveal' })
  await expect(reveal).toBeDisabled()
  await page.evaluate(async () => {
    const a = document.querySelector<HTMLAudioElement>('[data-testid="playback"]')!
    await new Promise((r) => (a.readyState >= 1 ? r(null) : a.addEventListener('loadedmetadata', () => r(null), { once: true })))
    a.muted = true
    await a.play()
  })
  for (const label of ['Clarity', 'Structure', 'Confidence', 'Conciseness', 'Engagement']) {
    await page.locator('div').filter({ hasText: new RegExp(`^${label}12345$`) }).getByRole('button', { name: '4' }).click({ timeout: 15_000 })
  }
  await page.getByLabel('Filler guess').fill('2')
  await reveal.click()
  await expect(page.getByText('Fillers / min')).toBeVisible()
  await page.getByRole('button', { name: 'Save take' }).click()
  await expect(page.getByText('Take 1 saved.')).toBeVisible({ timeout: 15_000 })

  await page.goto('/speak')
  await expect(page.getByTestId('recordings')).toContainText('Explain-It')
})
