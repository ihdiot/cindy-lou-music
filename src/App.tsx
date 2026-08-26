import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMidi } from './lib/midi/useMidi'
import { useMicCapture } from './lib/audio/useMicCapture'
import { transcribeAudio } from './lib/audio/transcribe'
import { synthesize } from './lib/audio/synth'
import { notesToScore } from './lib/music/pipeline'
import { scoreToAbc } from './lib/music/abc'
import type { NoteEvent, SavedSong } from './lib/music/types'
import { deleteSong, listSongs, saveSong } from './lib/store'
import { LiveLetters } from './components/LiveLetters'
import { StaffScore } from './components/StaffScore'
import { MelodyStrip } from './components/MelodyStrip'
import { SongList } from './components/SongList'

type Phase = 'idle' | 'recording' | 'reading' | 'review' | 'nothing-heard'

declare global {
  interface Window {
    /** Test hook: load a finished recording straight into review. */
    __cindyLoad?: (notes: NoteEvent[], title?: string) => void
    /** Test hook: synthesize tones, run real audio transcription, review. */
    __cindyTranscribeTest?: (
      seq: Array<{ midi: number; start: number; duration: number }>,
    ) => Promise<void>
  }
}

function defaultTitle(): string {
  return (
    'Song — ' +
    new Date().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  )
}

export default function App() {
  const midi = useMidi()
  const mic = useMicCapture()
  const [phase, setPhase] = useState<Phase>('idle')
  const [notes, setNotes] = useState<NoteEvent[]>([])
  const [title, setTitle] = useState(defaultTitle())
  const [songId, setSongId] = useState<string>('')
  const [songs, setSongs] = useState<SavedSong[]>([])

  const refreshSongs = useCallback(() => {
    listSongs().then(setSongs).catch(() => setSongs([]))
  }, [])

  useEffect(refreshSongs, [refreshSongs])

  const score = useMemo(
    () => (notes.length > 0 ? notesToScore(notes) : null),
    [notes],
  )
  const abc = useMemo(
    () => (score ? scoreToAbc(score, title) : ''),
    [score, title],
  )

  const persist = useCallback(
    (id: string, t: string, n: NoteEvent[]) => {
      if (n.length === 0) return
      saveSong({ id, title: t, createdAt: Number(id), notes: n })
        .then(refreshSongs)
        .catch(() => {})
    },
    [refreshSongs],
  )

  const finishRecording = useCallback(
    (played: NoteEvent[], t?: string) => {
      if (played.length === 0) {
        setPhase('nothing-heard')
        return
      }
      const id = String(Date.now())
      const newTitle = t ?? defaultTitle()
      setNotes(played)
      setTitle(newTitle)
      setSongId(id)
      setPhase('review')
      persist(id, newTitle, played)
    },
    [persist],
  )

  useEffect(() => {
    window.__cindyLoad = (n, t) => finishRecording(n, t)
    window.__cindyTranscribeTest = async (seq) => {
      const notes = await transcribeAudio(synthesize(seq))
      finishRecording(notes, 'Microphone test')
    }
    return () => {
      delete window.__cindyLoad
      delete window.__cindyTranscribeTest
    }
  }, [finishRecording])

  // A USB-MIDI keyboard is always preferred; the microphone is the fallback.
  const usingMidi = midi.inputs.length > 0

  const start = async () => {
    if (usingMidi) {
      midi.startRecording()
      setPhase('recording')
      return
    }
    const ok = await mic.ensureOpen()
    if (!ok) return // denied — the coach card explains
    mic.startRecording()
    setPhase('recording')
  }

  const stop = async () => {
    if (usingMidi) {
      finishRecording(midi.stopRecording())
      return
    }
    setPhase('reading')
    try {
      finishRecording(await mic.stopRecording())
    } catch {
      setPhase('nothing-heard')
    }
  }

  const rename = (t: string) => {
    setTitle(t)
    if (songId) persist(songId, t, notes)
  }

  const openSong = (s: SavedSong) => {
    setNotes(s.notes)
    setTitle(s.title)
    setSongId(s.id)
    setPhase('review')
  }

  const startOver = () => {
    setNotes([])
    setSongId('')
    setTitle(defaultTitle())
    setPhase('idle')
  }

  const connected = midi.inputs.length > 0
  const recording = phase === 'recording'

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10 text-forest">
      <header className="no-print mb-10 text-center">
        <h1 className="font-script text-8xl leading-tight text-forest drop-shadow-[0_1px_0_rgba(255,255,255,0.7)]">
          Cindy Lou Music
        </h1>
        <div className="ornament mt-3 text-xl">&#9834;</div>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.35em] text-brass">
          Play &middot; Print &middot; Keep
        </p>
      </header>

      {/* Input status — quiet when good, helpful when not */}
      {phase !== 'review' && (
      <div className="no-print mb-6" data-testid="midi-status">
        {mic.status === 'denied' ? (
          <div className="rounded-2xl border border-berry/30 bg-berry/10 px-5 py-4 text-center">
            <strong>One more step:</strong> click the little padlock next to
            the web address, switch Microphone to Allow, and reload this
            page.
          </div>
        ) : connected ? (
          <p className="text-center text-lg italic text-forest/60">
            &#10003; Your piano is connected by USB — every note lands
            perfectly
          </p>
        ) : (
          <div className="plate rounded-2xl border border-forest/15 bg-parchment px-8 py-6 shadow-[0_10px_30px_-12px_rgba(29,59,40,0.25)]">
            <p className="text-2xl font-semibold">
              I'll listen while you play
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-lg text-forest/75">
              <li>Sit the computer close to the piano, volume up.</li>
              <li>Tap Start, then choose Allow when the page asks.</li>
              <li>
                Clearest results: a cable from the piano's headphone jack to
                the computer.
              </li>
            </ul>
            <p className="mt-2 italic text-forest/60">
              Have a USB-MIDI keyboard? Just plug it in — I'll use it
              automatically.
            </p>
          </div>
        )}
      </div>
      )}

      {/* Live letters — press a key, see its name */}
      {phase !== 'review' && (
        <div className="no-print plate rounded-3xl border border-forest/10 bg-parchment shadow-[0_14px_40px_-16px_rgba(29,59,40,0.3)]">
          <LiveLetters
            held={
              usingMidi ? midi.held : mic.midi !== null ? [mic.midi] : []
            }
          />
          {!usingMidi && mic.status === 'ready' && (
            <div className="px-10 pb-4" aria-hidden>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-forest/10"
                data-testid="mic-level"
              >
                <div
                  className="h-full rounded-full bg-brass transition-[width] duration-100"
                  style={{ width: `${Math.round(mic.level * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* The one big button */}
      {phase !== 'review' && phase !== 'reading' && (
      <div className="no-print mt-8 flex flex-col items-center gap-4">
        {recording ? (
          <>
            <button
              onClick={stop}
              data-testid="stop"
              className="rounded-full bg-gradient-to-b from-berry to-[#701f1c] px-24 py-7 text-4xl font-semibold tracking-wide text-white shadow-[0_18px_35px_-12px_rgba(142,47,43,0.55),inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:scale-[1.03]"
            >
              Stop
            </button>
            <p className="flex items-center gap-2 text-xl italic text-forest/70">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-berry" />
              I'm listening — play away
            </p>
          </>
        ) : (
          <>
            <button
              onClick={start}
              data-testid="start"
              className="rounded-full bg-gradient-to-b from-forest-light to-forest px-24 py-7 text-4xl font-semibold tracking-wide text-cream shadow-[0_18px_35px_-12px_rgba(29,59,40,0.55),inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-brass/40 transition hover:scale-[1.03]"
            >
              Start
            </button>
            {phase === 'idle' && (
              <p className="text-lg italic text-forest/55">
                Tap Start &middot; play your song &middot; tap Stop
              </p>
            )}
          </>
        )}
      </div>
      )}

      {phase === 'reading' && (
        <div
          className="no-print mx-auto mt-8 flex max-w-xl items-center justify-center gap-3 rounded-2xl border border-forest/15 bg-parchment px-6 py-5 text-center text-xl italic shadow-sm"
          data-testid="reading"
        >
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brass" />
          Reading your music&hellip;
        </div>
      )}

      {phase === 'nothing-heard' && (
        <div
          className="no-print mx-auto mt-8 max-w-xl rounded-2xl border border-forest/15 bg-white/70 px-6 py-5 text-center text-lg shadow-sm"
          data-testid="nothing-heard"
        >
          I didn't hear any notes that time. Turn the piano's volume up,
          press a key and watch for its letter above — if it shows up, tap
          Start and try again.
        </div>
      )}

      {phase === 'review' && score && (
        <section className="mt-10">
          <div className="no-print mb-4 flex flex-wrap items-center gap-3">
            <input
              value={title}
              onChange={(e) => rename(e.target.value)}
              aria-label="Song name"
              className="min-w-60 flex-1 rounded-2xl border border-forest/15 bg-parchment px-5 py-3 text-2xl shadow-sm focus:border-brass focus:outline-none"
            />
            <button
              onClick={() => window.print()}
              className="rounded-2xl bg-gradient-to-b from-forest-light to-forest px-9 py-3 text-2xl font-semibold text-cream shadow-md ring-1 ring-brass/40 transition hover:scale-[1.02]"
            >
              Print
            </button>
            <button
              onClick={startOver}
              className="rounded-2xl border border-forest/25 px-7 py-3 text-2xl transition hover:bg-forest/5"
            >
              Play another
            </button>
          </div>

          <div className="print-area plate rounded-3xl border border-forest/10 bg-parchment p-10 shadow-[0_20px_50px_-20px_rgba(29,59,40,0.35)]">
            <StaffScore abc={abc} />
          </div>

          <div className="no-print mt-10">
            <h2 className="mb-3 text-2xl font-semibold">
              Your notes, in order
            </h2>
            <MelodyStrip score={score} />
          </div>
        </section>
      )}

      {phase !== 'recording' && (
        <SongList
          songs={songs}
          onOpen={openSong}
          onDelete={(id) => deleteSong(id).then(refreshSongs)}
        />
      )}
    </div>
  )
}
