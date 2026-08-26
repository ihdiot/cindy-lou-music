# Cindy Lou Music

Play a real piano into the computer, get printable beginner-friendly sheet
music with letter names under every note. Works two ways, picked
automatically:

- **USB-MIDI keyboard plugged in** → perfect note capture (Web MIDI).
- **No USB piano** → the computer *listens* and transcribes the sound with
  Spotify's Basic Pitch ML model (loaded lazily — MIDI users never download
  it). Melodies come out great; dense two-hand playing is a good draft.

Built for Microsoft Edge and the Alesis Melody 61 (mom's has no USB-MIDI,
hence the listening path).

## For mom

Open the website, tap **Start**, choose **Allow** when it asks about the
microphone, play, tap **Stop**, tap **Print**.

Clearest results: a cable from the piano's **PHONES** jack to the computer's
line-in (blue jack), with a headphone splitter so she still hears herself.
The room microphone works too — sit the computer close, volume up.

Songs save automatically in the browser (IndexedDB `bench-notes` — never
rename that database).

## How it works

MIDI in (`src/lib/midi/useMidi.ts`, sustain-pedal aware) **or**
mic in (`src/lib/audio/recorder.ts`, raw PCM via AudioWorklet, echo
cancellation off, resampled to 22050 Hz) →
Basic Pitch transcription for audio (`src/lib/audio/transcribe.ts`) →
tempo grid fit + quantize (`src/lib/music/quantize.ts`) →
hand split with chord integrity (`src/lib/music/hands.ts`) →
key detection + spelling (`src/lib/music/letters.ts`) →
ABC engraving with `w:` letter rows, 4 bars/line (`src/lib/music/abc.ts`) →
abcjs SVG (`src/components/StaffScore.tsx`).

While the mic is open, a YIN pitch detector (`src/lib/audio/livePitch.ts`)
drives the big live letters — display only; the real transcription happens
after Stop. No fake demo takes: silence gets an honest "I didn't hear any
notes."

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # 40 unit tests (C-D-E fixture, chords, jitter, hands, audio)
npx playwright install chromium   # once (full Chromium — headless shell has no audio)
npm run e2e        # 11 browser tests + screenshots in e2e/out/
npm run build      # dist/ (base './', model served from /model)
```

Deploy: GitHub Pages serves `docs/` on main — copy `dist/` over `docs/`
and push.

Test hooks on `window`: `__cindy.noteOn/noteOff/pedal/plug` simulates live
MIDI; `__cindyLoad(notes, title)` loads a finished take straight into
review; `__cindyTranscribeTest(seq)` synthesizes tones and runs the real
audio transcription.
