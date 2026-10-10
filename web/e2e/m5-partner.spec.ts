import { expect, test, type Browser, type Page } from '@playwright/test'
import { capture, signUp } from './helpers'

async function userWithTask(browser: Browser, title: string): Promise<Page> {
  const ctx = await browser.newContext({ permissions: ['microphone', 'camera'] })
  const page = await ctx.newPage()
  await signUp(page)
  await capture(page, `${title} ~25m`)
  await page.goto('/inbox')
  const row = page.getByTestId('inbox-list').locator('li').filter({ hasText: title })
  await row.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(row).toBeHidden()
  return page
}

async function pair(a: Page, b: Page) {
  await a.goto('/partner')
  const code = (await a.getByTestId('partner-code').textContent())!.trim()
  await b.goto('/partner')
  await b.getByLabel('Add a friend by their code').fill(code)
  await b.getByRole('button', { name: 'Send request' }).click()
  await expect(b.getByText('Request sent.')).toBeVisible()
  await a.reload()
  await a.getByRole('button', { name: 'Accept' }).click()
  await expect(a.getByRole('button', { name: 'Focus together' })).toBeVisible()
}

test('partners: code → accept → invite → join → pair room → shared countdown → leave', async ({ browser }) => {
  test.setTimeout(150_000)
  const a = await userWithTask(browser, 'Alpha task')
  const b = await userWithTask(browser, 'Beta task')
  await pair(a, b)

  // Counts, not content, by default
  await b.goto('/partner')
  await expect(b.getByText(/Today: 0\/1 done/)).toBeVisible()
  await expect(b.getByText('Alpha task')).toBeHidden()

  // A starts a shared list with B; B joins it
  await a.goto('/partner')
  await a.getByLabel('Shared list name').fill('Biology finals')
  await a.getByRole('button', { name: 'Start' }).click()
  await expect(a.getByText(/Waiting for .* to join/)).toBeVisible()
  await b.reload()
  await b.getByRole('button', { name: /Join “Biology finals”/ }).click()
  await b.getByLabel('Add to Biology finals').fill('Chapter 1 summary')
  await b.getByLabel('Add to Biology finals').press('Enter')
  await expect(b.getByText('Chapter 1 summary')).toBeVisible()

  // A invites; B gets a small card on Home and joins → both land in the room
  await b.goto('/')
  await a.getByRole('button', { name: 'Focus together' }).click()
  await a.getByRole('button', { name: 'Send invite' }).click()
  await expect(b.getByRole('dialog', { name: 'Session invite' })).toBeVisible({ timeout: 20_000 })
  await b.getByRole('button', { name: 'Join now' }).click()
  await expect(b).toHaveURL(/\/pair\//)
  await expect(a).toHaveURL(/\/pair\//, { timeout: 25_000 })

  // Check-in shows my tasks and the shared list's items, grouped
  await expect(a.getByText(/Biology finals · shared with/)).toBeVisible()
  await expect(a.getByRole('radio', { name: 'Chapter 1 summary' })).toBeVisible()

  // Check-in → shared 3-2-1 → focusing together
  for (const p of [a, b]) {
    await expect(p.getByRole('heading', { name: 'Check in' })).toBeVisible()
    await p.getByRole('button', { name: 'I’m ready' }).click()
  }
  for (const p of [a, b]) await expect(p.getByRole('button', { name: 'Finish' })).toBeVisible({ timeout: 15_000 })

  // The shared list is right there in the room: B ticks an item, A sees it
  await b.getByRole('button', { name: /Shared list · 1 left/ }).click()
  await b.getByRole('button', { name: 'Done: Chapter 1 summary' }).click()
  await a.getByRole('button', { name: /Shared list/ }).click()
  await expect(a.getByRole('button', { name: 'Undo Chapter 1 summary' })).toBeVisible({ timeout: 10_000 })

  // B leaves; A is told and keeps going
  await b.getByRole('button', { name: 'Leave' }).click()
  await expect(b.getByRole('heading', { name: 'Nice session together.' })).toBeVisible()
  await expect(a.getByText(/had to go/)).toBeVisible({ timeout: 10_000 })
})

test('invite link pairs a new account; the built-in audio call connects', async ({ browser }) => {
  test.setTimeout(150_000)
  const a = await userWithTask(browser, 'Gamma task')
  await a.goto('/partner')
  await a.getByRole('button', { name: 'Create invite link' }).click()
  const link = (await a.locator('code').textContent())!.trim()

  // A friend opens the link signed out → signs up → is asked to pair
  const ctx = await browser.newContext({ permissions: ['microphone', 'camera'] })
  const b = await ctx.newPage()
  await b.goto(new URL(link).pathname)
  await expect(b.getByText('You’ve been invited to focus together')).toBeVisible()
  await signUp(b, undefined, { onboarding: 'keep' }) // the app goes straight on to finish the invite
  await expect(b.getByRole('heading', { name: /Be study friends with/ })).toBeVisible({ timeout: 15_000 })
  await b.getByRole('button', { name: 'Accept' }).click()
  await expect(b).toHaveURL(/\/partner$/)
  await expect(b.getByRole('button', { name: 'Focus together' })).toBeVisible()
  await capture(b, 'Delta task ~25m')
  await b.goto('/inbox')
  await b.getByTestId('inbox-list').locator('li').filter({ hasText: 'Delta task' }).getByRole('button', { name: 'Today', exact: true }).click()
  await expect(b.getByTestId('inbox-list')).toBeHidden()

  // Session with an audio call
  await b.goto('/partner')
  await b.getByRole('button', { name: 'Focus together' }).click()
  await b.getByRole('radio', { name: /Audio/ }).click()
  await b.getByRole('button', { name: 'Send invite' }).click()
  await a.goto('/')
  await expect(a.getByText(/audio call\?/)).toBeVisible({ timeout: 20_000 })
  await expect(a.getByRole('dialog', { name: 'Session invite' })).toBeVisible({ timeout: 20_000 })
  await a.getByRole('button', { name: 'Join now' }).click()
  await expect(b).toHaveURL(/\/pair\//, { timeout: 25_000 })
  // The call connects for both straight away (one call type for the room)
  for (const p of [a, b]) await expect(p.getByTestId('call-state')).toHaveText('Connected', { timeout: 30_000 })
  // A switches the room to video: it changes for B too, B is told, and it reconnects
  await a.getByRole('radio', { name: /Video/ }).click()
  await expect(b.getByText(/switched the call to video/)).toBeVisible({ timeout: 10_000 })
  await expect(b.getByRole('radio', { name: /Video/ })).toHaveAttribute('aria-checked', 'true')
  for (const p of [a, b]) await expect(p.getByTestId('call-state')).toHaveText('Connected', { timeout: 30_000 })
})

test('friends: per-friend sharing, group invite to two friends → study room for three', async ({ browser }) => {
  test.setTimeout(180_000)
  const a = await userWithTask(browser, 'Room host task')
  const b = await userWithTask(browser, 'Room guest one')
  const c = await userWithTask(browser, 'Room guest two')
  await pair(a, b)
  await pair(a, c)

  // A has two friends; sharing is set per friend
  await a.goto('/partner')
  await expect(a.getByRole('region', { name: 'Friends list' }).getByRole('button')).toHaveCount(2)
  await a.getByRole('radio', { name: /Exact/ }).click()
  await expect(a.getByText('Saved.')).toBeVisible()

  // Invite both: everyone ends up in one room
  for (const p of [b, c]) await p.goto('/')
  await a.getByRole('button', { name: 'Focus together' }).click()
  const sheet = a.getByRole('dialog')
  await sheet.getByRole('group', { name: 'Friends' }).getByRole('button', { pressed: false }).click()
  await sheet.getByRole('button', { name: /Send invite to 2 friends/ }).click()
  for (const p of [b, c]) {
    await expect(p.getByRole('dialog', { name: 'Session invite' })).toBeVisible({ timeout: 20_000 })
    await expect(p.getByText(/\+ 1 other/)).toBeVisible()
    await p.getByRole('button', { name: 'Join now' }).click()
    await expect(p).toHaveURL(/\/pair\//)
  }
  await expect(a).toHaveURL(/\/pair\//, { timeout: 25_000 })
  for (const p of [a, b, c]) await expect(p.getByText(/Study room with/)).toBeVisible({ timeout: 15_000 })

  for (const p of [a, b, c]) {
    await p.getByRole('button', { name: 'I’m ready' }).click()
  }
  for (const p of [a, b, c]) await expect(p.getByRole('button', { name: 'Finish' })).toBeVisible({ timeout: 15_000 })

  // One leaves; the other two carry on
  await c.getByRole('button', { name: 'Leave' }).click()
  await expect(a.getByText(/had to go\. The rest of you carry on/)).toBeVisible({ timeout: 10_000 })
})
