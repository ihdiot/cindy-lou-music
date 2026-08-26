# Cindy Lou Music

Play a real piano into the computer, get printable beginner-friendly sheet
music with letter names under every note. Built for a class-compliant
USB-MIDI keyboard (Alesis Melody 61 MKII) and Microsoft Edge.

## For mom

Double-click **Cindy Lou Music.html** (one self-contained file, works
offline). Plug the USB cable from the piano's square port into the computer,
turn the piano on, press a key — its letter appears. Tap **Start**, play,
tap **Stop**, tap **Print**.

Songs save automatically in the browser (IndexedDB `bench-notes` — never
rename that database).

## How it works

MIDI in (`src/lib/midi/useMidi.ts`, sustain-pedal aware) →
tempo grid fit + quantize (`src/lib/music/quantize.ts`) →
hand split with chord integrity (`src/lib/music/hands.ts`) →
key detection + spelling (`src/lib/music/letters.ts`) →
ABC engraving with `w:` letter rows, 4 bars/line (`src/lib/music/abc.ts`) →
abcjs SVG (`src/components/StaffScore.tsx`).

No microphone pitch detection — MIDI only. No fake demo takes: silence gets
an honest "I didn't hear any notes."

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # 35 unit tests (fixtures: C-D-E, jitter, chords, hands)
npx playwright install chromium   # once
npm run e2e        # 9 browser tests + screenshots in e2e/out/
npm run build      # single-file dist/index.html
node scripts/smoke-file.mjs       # verifies the file:// double-click path
```

Test hooks on `window`: `__cindy.noteOn/noteOff/pedal` simulates live MIDI;
`__cindyLoad(notes, title)` loads a finished take straight into review.
