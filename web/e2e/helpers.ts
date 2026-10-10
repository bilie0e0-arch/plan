import { expect, type Page } from '@playwright/test'

export function uniqueUser() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return { username: `u_${id}`.slice(0, 20), email: `${id}@test.dev`, password: 'a-long-test-password' }
}

export async function signUp(page: Page, u = uniqueUser(), opts: { onboarding?: 'skip' | 'keep' } = {}) {
  await page.goto('/signup')
  await page.getByLabel('Username').fill(u.username)
  await page.getByLabel('Recovery email').fill(u.email)
  await page.getByLabel('Password').fill(u.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  // Lands on Home — or, after opening an invite link, goes straight on to finish pairing.
  await expect(page).toHaveURL(opts.onboarding === 'keep' ? /\/($|join\/)/ : /\/$/)
  if (opts.onboarding !== 'keep') {
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }
  return u
}

export async function capture(page: Page, text: string) {
  await page.locator('body').press('q')
  const input = page.getByRole('textbox', { name: 'Capture' })
  await expect(input).toBeFocused()
  await input.fill(text)
  await input.press('Enter')
  await expect(input).toBeHidden()
}
