import { expect, test } from '@playwright/test'

/**
 * End-to-end acceptance, per the handoff:
 * an injected C-D-E must show three treble notes labeled C D E;
 * a G3-G4 scale stays on one staff; silence is honest; live MIDI works.
 */

const quarters = (midis: number[], gap = 0.5, held = 0.42) =>
  midis.map((midi, i) => ({
    midi,
    start: i * gap,
    duration: held,
    velocity: 0.8,
  }))

async function svgText(page: import('@playwright/test').Page): Promise<string> {
  return page.locator('[data-testid="staff"]').innerText()
}

test('C D E comes out as C D E on one treble staff, letters visible', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__cindyLoad === 'function')
  await page.evaluate(
    (notes) => window.__cindyLoad!(notes, 'C D E test'),
    quarters([60, 62, 64]),
  )

  const staff = page.locator('[data-testid="staff"] svg').first()
  await expect(staff).toBeVisible()

  // exactly one staff (no bass) in the rendered system
  const staves = page.locator('[data-testid="staff"] .abcjs-staff')
  await expect(staves).toHaveCount(1)

  // three real notes
  const notes = page.locator(
    '[data-testid="staff"] .abcjs-note:not(.abcjs-rest)',
  )
  await expect(notes).toHaveCount(3)

  // the letter row under the staff says C D E
  const text = await svgText(page)
  expect(text).toContain('C')
  expect(text).toContain('D')
  expect(text).toContain('E')

  // the strip lists every note as a letter chip
  const chips = page.locator('[data-testid="melody-strip"] span')
  await expect(chips).toHaveText(['C', 'D', 'E'])

  await page.screenshot({ path: 'e2e/out/cde.png', fullPage: true })
})

test('a G3-G4 one-hand scale stays on ONE staff', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__cindyLoad === 'function')
  await page.evaluate(
    (notes) => window.__cindyLoad!(notes, 'G scale'),
    quarters([55, 57, 59, 60, 62, 64, 65, 67]),
  )
  await expect(
    page.locator('[data-testid="staff"] svg').first(),
  ).toBeVisible()
  // 8 quarters = 2 measures = one 4-bar system with a single staff
  await expect(page.locator('[data-testid="staff"] .abcjs-staff')).toHaveCount(1)
  const notes = page.locator(
    '[data-testid="staff"] .abcjs-note:not(.abcjs-rest)',
  )
  await expect(notes).toHaveCount(8)
  await page.screenshot({ path: 'e2e/out/scale.png', fullPage: true })
})

test('two-hand playing gets a grand staff (treble + bass)', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__cindyLoad === 'function')
  const notes = [
    { midi: 48, start: 0, duration: 1.9, velocity: 0.7 },
    { midi: 52, start: 0.01, duration: 1.9, velocity: 0.7 },
    ...quarters([72, 74, 76, 77]),
  ]
  await page.evaluate((n) => window.__cindyLoad!(n, 'Both hands'), notes)
  await expect(
    page.locator('[data-testid="staff"] svg').first(),
  ).toBeVisible()
  await expect(page.locator('[data-testid="staff"] .abcjs-staff')).toHaveCount(2)
  await page.screenshot({ path: 'e2e/out/grand.png', fullPage: true })
})

test('live MIDI: letters show while held, Stop engraves what was played', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__cindy === 'object')
  await page.evaluate(() => window.__cindy!.plug())

  await page.getByTestId('start').click()

  // play C, watch the big letter appear
  await page.evaluate(() => window.__cindy!.noteOn(60))
  await expect(page.getByTestId('live-letters')).toContainText('C')
  await page.waitForTimeout(420)
  await page.evaluate(() => window.__cindy!.noteOff(60))

  await page.waitForTimeout(80)
  await page.evaluate(() => window.__cindy!.noteOn(62))
  await page.waitForTimeout(420)
  await page.evaluate(() => window.__cindy!.noteOff(62))

  await page.waitForTimeout(80)
  await page.evaluate(() => window.__cindy!.noteOn(64))
  await page.waitForTimeout(420)
  await page.evaluate(() => window.__cindy!.noteOff(64))

  await page.getByTestId('stop').click()

  await expect(
    page.locator('[data-testid="staff"] svg').first(),
  ).toBeVisible()
  const notes = page.locator(
    '[data-testid="staff"] .abcjs-note:not(.abcjs-rest)',
  )
  await expect(notes).toHaveCount(3)
  const chips = page.locator('[data-testid="melody-strip"] span')
  await expect(chips).toHaveText(['C', 'D', 'E'])
  await page.screenshot({ path: 'e2e/out/live-midi.png', fullPage: true })
})

test('sustain pedal extends the note, like real notation', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__cindy === 'object')
  await page.evaluate(() => window.__cindy!.plug())
  await page.getByTestId('start').click()

  await page.evaluate(() => window.__cindy!.pedal(true))
  await page.evaluate(() => window.__cindy!.noteOn(60))
  await page.waitForTimeout(150)
  await page.evaluate(() => window.__cindy!.noteOff(60)) // key up, pedal holds
  await page.waitForTimeout(600)
  await page.evaluate(() => window.__cindy!.pedal(false)) // now it ends

  await page.getByTestId('stop').click()
  await expect(
    page.locator('[data-testid="staff"] svg').first(),
  ).toBeVisible()
  await expect(
    page.locator('[data-testid="staff"] .abcjs-note:not(.abcjs-rest)'),
  ).toHaveCount(1)
})

test('stopping with nothing played is honest — no invented notes', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__cindy === 'object')
  await page.evaluate(() => window.__cindy!.plug())
  await page.getByTestId('start').click()
  await page.waitForTimeout(300)
  await page.getByTestId('stop').click()

  await expect(page.getByTestId('nothing-heard')).toBeVisible()
  await expect(page.locator('[data-testid="staff"]')).toHaveCount(0)
})

test('microphone path: C D E played as sound comes out as C D E', async ({
  page,
}) => {
  // Real in-browser Basic Pitch run: synthesized piano tones -> the model
  // (fetched from this same site) -> the same review screen. This is the
  // path mom's keyboard uses. First run downloads tfjs + the model.
  test.setTimeout(180_000)
  await page.goto('/')
  await page.waitForFunction(
    () => typeof window.__cindyTranscribeTest === 'function',
  )
  await page.evaluate(() =>
    window.__cindyTranscribeTest!([
      { midi: 60, start: 0.2, duration: 0.45 },
      { midi: 62, start: 0.8, duration: 0.45 },
      { midi: 64, start: 1.4, duration: 0.45 },
    ]),
  )
  await expect(page.locator('[data-testid="staff"] svg').first()).toBeVisible({
    timeout: 120_000,
  })
  const chips = page.locator(
    '[data-testid="melody-strip"] span[data-hand="treble"]',
  )
  await expect(chips).toContainText(['C', 'D', 'E'])
  await page.screenshot({ path: 'e2e/out/mic-cde.png', fullPage: true })
})

test('microphone flow: Start opens the mic, level meter runs, Stop reads', async ({
  page,
}) => {
  // No keyboard plugged -> Start takes the listening path (fake mic device).
  test.setTimeout(180_000)
  await page.goto('/')
  await page.getByTestId('start').click()

  // The mic opened: the "I can hear you" meter is on screen.
  await expect(page.getByTestId('mic-level')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1200)
  await page.getByTestId('stop').click()

  // "Reading your music…" shows, then an honest outcome either way:
  // the fake device's test tone may or may not contain real notes.
  await expect(page.getByTestId('reading')).toBeVisible()
  await expect(
    page
      .locator('[data-testid="staff"] svg')
      .first()
      .or(page.getByTestId('nothing-heard')),
  ).toBeVisible({ timeout: 120_000 })
})

test('songs persist across a reload (IndexedDB bench-notes)', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__cindyLoad === 'function')
  await page.evaluate(
    (notes) => window.__cindyLoad!(notes, 'Keep me'),
    quarters([60, 64, 67]),
  )
  await expect(page.locator('[data-testid="staff"] svg').first()).toBeVisible()

  await page.reload()
  await expect(page.getByText('Keep me')).toBeVisible()
  await page.getByText('Keep me').click()
  await expect(page.locator('[data-testid="staff"] svg').first()).toBeVisible()
})

test('a real two-hand piece with human timing engraves cleanly', async ({
  page,
}) => {
  // Ode to Joy, first phrase. RH melody quarters at ~120bpm with fixed
  // "human" jitter; LH root-third halves. This is the experienced-player case.
  const jitter = [0.03, -0.02, 0.04, -0.03, 0.02, -0.04, 0.03, 0.01, -0.02, 0.02, -0.03, 0.04, 0.02, -0.01, 0.03, -0.02]
  const rhMidis = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62]
  const notes = rhMidis.map((midi, i) => ({
    midi,
    start: i * 0.5 + jitter[i],
    duration: i === 14 ? 0.9 : 0.42,
    velocity: 0.7 + (i % 3) * 0.08,
  }))
  // LH: C3+G3 under bars 1-2, G2+G3 under bar 3, C3+G3 bar 4
  for (const [bar, root] of [
    [0, 48],
    [1, 48],
    [2, 43],
    [3, 48],
  ] as const) {
    notes.push({ midi: root, start: bar * 2 + 0.01, duration: 1.85, velocity: 0.6 })
    notes.push({ midi: 55, start: bar * 2 + 0.02, duration: 1.85, velocity: 0.6 })
  }
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__cindyLoad === 'function')
  await page.evaluate((n) => window.__cindyLoad!(n, 'Ode to Joy'), notes)

  await expect(page.locator('[data-testid="staff"] svg').first()).toBeVisible()
  await expect(page.locator('[data-testid="staff"] .abcjs-staff')).toHaveCount(2)
  // all 15 melody notes survive, in order, on the treble staff
  const chips = page.locator(
    '[data-testid="melody-strip"] span[data-hand="treble"]',
  )
  await expect(chips).toHaveText(
    ['E', 'E', 'F', 'G', 'G', 'F', 'E', 'D', 'C', 'C', 'D', 'E', 'E', 'D', 'D'],
  )
  await page.screenshot({ path: 'e2e/out/ode.png', fullPage: true })
})

test('print view hides the app chrome and keeps the music', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__cindyLoad === 'function')
  await page.evaluate(
    (notes) => window.__cindyLoad!(notes, 'Printable'),
    quarters([60, 62, 64]),
  )
  await expect(page.locator('[data-testid="staff"] svg').first()).toBeVisible()

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByTestId('start')).toBeHidden()
  await expect(page.getByTestId('midi-status')).toBeHidden()
  await expect(page.locator('[data-testid="staff"] svg').first()).toBeVisible()
  await page.screenshot({ path: 'e2e/out/print.png', fullPage: true })
})
