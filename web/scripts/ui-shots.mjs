// Visual check for the UI pass: signs up a fresh user, adds a few tasks and screenshots key screens
// at desktop and phone sizes, reporting pages that need vertical scrolling.
// Usage: node scripts/ui-shots.mjs <outDir> [paths...]   (app must be running on :3000)
import { chromium } from '@playwright/test'

const out = process.argv[2]
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ['/']
const id = Date.now().toString(36)
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto('http://localhost:3000/signup')
await page.getByLabel('Username').fill(`ui_${id}`.slice(0, 20))
await page.getByLabel('Recovery email').fill(`${id}@test.dev`)
await page.getByLabel('Password').fill('a-long-test-password')
await page.getByRole('button', { name: 'Create account' }).click()
await page.waitForURL('http://localhost:3000/')
await page.getByRole('button', { name: 'Skip for now' }).click({ timeout: 15000 }).catch(() => {})
await page.waitForTimeout(500)
for (const t of ['Read chapter 3 ~25m', 'Write the intro ~45m', 'Call Sam ~15m']) {
  await page.getByLabel('What do you want to do?').fill(t)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.waitForTimeout(700)
}

for (const p of paths) {
  for (const [w, h, tag] of [[1366, 768, 'desktop'], [390, 844, 'phone']]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`http://localhost:3000${p}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    const scroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    const name = `${p === '/' ? 'today' : p.replace(/[/?=&]/g, '_').replace(/^_/, '')}-${tag}`
    await page.screenshot({ path: `${out}/${name}.png` })
    console.log(`${name}: overflow ${scroll}px`)
  }
}
console.log('ERRORS', JSON.stringify(errors))
await browser.close()
