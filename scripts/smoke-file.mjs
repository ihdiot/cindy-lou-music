// Smoke test: the single-file build must work when double-clicked (file://).
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const target = 'file:///' + path.join(root, 'dist', 'index.html').replaceAll('\\', '/')

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(target)

await page.waitForFunction(() => typeof window.__cindyLoad === 'function')
await page.evaluate(() => {
  window.__cindyLoad(
    [
      { midi: 60, start: 0.0, duration: 0.42, velocity: 0.8 },
      { midi: 62, start: 0.5, duration: 0.42, velocity: 0.8 },
      { midi: 64, start: 1.0, duration: 0.42, velocity: 0.8 },
    ],
    'Double-click test',
  )
})
await page.waitForSelector('[data-testid="staff"] svg')
const notes = await page.locator('[data-testid="staff"] .abcjs-note:not(.abcjs-rest)').count()
const text = await page.locator('[data-testid="staff"]').innerText()
await page.screenshot({ path: 'e2e/out/file-smoke.png', fullPage: true })
await browser.close()

if (notes !== 3 || !text.includes('C') || !text.includes('D') || !text.includes('E')) {
  console.error(`FAIL: notes=${notes}, letters=${JSON.stringify(text)}`)
  process.exit(1)
}
console.log('OK: file:// single-file build renders C D E with letters')
