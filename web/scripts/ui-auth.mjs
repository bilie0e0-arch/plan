import { chromium } from '@playwright/test'
const out = process.argv[2]
const b = await chromium.launch()
for (const [w, h, tag] of [[1366, 768, 'desktop'], [390, 844, 'phone']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  for (const path of ['/login', '/signup']) { await p.goto('http://localhost:3000' + path); await p.waitForTimeout(800); await p.screenshot({ path: `${out}/auth${path.replace('/', '-')}-${tag}.png` }) }
}
await b.close()
