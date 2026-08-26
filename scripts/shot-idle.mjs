// Capture the first-open (idle) screen of the single-file build.
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const target = 'file:///' + path.join(root, 'dist', 'index.html').replaceAll('\\', '/')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
await page.goto(target)
await page.waitForSelector('[data-testid="start"]')
await page.waitForTimeout(300)
await page.screenshot({ path: 'e2e/out/idle.png', fullPage: true })
await browser.close()
console.log('saved e2e/out/idle.png')
