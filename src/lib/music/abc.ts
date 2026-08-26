/**
 * Engrave a ScoreModel as ABC notation for abcjs.
 *
 * - L:1/16 — one tick = one 16th. "E4" in this file means E held 4 ticks
 *   (a quarter note), NOT the pitch E4.
 * - 4 measures per line; a newline in ABC is a new printed system.
 * - Every note gets its letter name in a w: (lyric) line under the staff —
 *   that is the primer-style row mom reads.
 */
import type { QuantizedNote, ScoreModel } from './types'
import { type Letter, keySignature, spell } from './letters'

const TICKS_PER_MEASURE = 16
const MEASURES_PER_LINE = 4
/** Duration chunks that engrave cleanly, largest first. */
const CHUNKS = [16, 12, 8, 6, 4, 3, 2, 1]

interface ChordEvent {
  startTick: number
  durTicks: number
  midis: number[]
}

/** Group same-tick notes into chords; clip overlaps so each staff is a single readable line. */
export function toEvents(notes: QuantizedNote[]): ChordEvent[] {
  const byStart = new Map<number, QuantizedNote[]>()
  for (const n of notes) {
    const list = byStart.get(n.startTick) ?? []
    list.push(n)
    byStart.set(n.startTick, list)
  }
  const events: ChordEvent[] = [...byStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startTick, group]) => ({
      startTick,
      durTicks: Math.max(...group.map((g) => g.durTicks)),
      midis: [...new Set(group.map((g) => g.midi))].sort((a, b) => a - b),
    }))
  for (let i = 0; i < events.length - 1; i++) {
    const room = events[i + 1].startTick - events[i].startTick
    events[i].durTicks = Math.min(events[i].durTicks, room)
  }
  return events
}

function abcPitch(
  midi: number,
  key: string,
  measureState: Map<string, number>,
): string {
  const s = spell(midi, key)
  const sig = keySignature(key)
  const stateKey = `${s.letter}${s.octave}`
  const current = measureState.get(stateKey) ?? sig[s.letter as Letter]
  let acc = ''
  if (s.alt !== current) {
    acc = s.alt === 1 ? '^' : s.alt === -1 ? '_' : '='
    measureState.set(stateKey, s.alt)
  }
  let letter: string
  let marks: string
  if (s.octave >= 5) {
    letter = s.letter.toLowerCase()
    marks = "'".repeat(s.octave - 5)
  } else {
    letter = s.letter
    marks = ','.repeat(4 - s.octave)
  }
  return acc + letter + marks
}

function durSuffix(ticks: number): string {
  return ticks === 1 ? '' : String(ticks)
}

interface VoiceLine {
  /** ABC music, one string per measure */
  measures: string[]
  /** letter-name lyrics, one string per measure */
  lyrics: string[]
}

/** Render one staff. Gaps become rests; long notes tie across barlines. */
export function voiceToAbc(
  notes: QuantizedNote[],
  key: string,
  totalMeasures: number,
): VoiceLine {
  const events = toEvents(notes)
  const measures: string[] = []
  const lyrics: string[] = []
  let m = ''
  let ly = ''
  let cursor = 0
  let measureState = new Map<string, number>()

  const flushMeasure = () => {
    measures.push(m.trim())
    lyrics.push(ly.trim())
    m = ''
    ly = ''
    measureState = new Map()
  }

  const roomInMeasure = () => TICKS_PER_MEASURE - (cursor % TICKS_PER_MEASURE)

  const emitRest = (ticks: number) => {
    let left = ticks
    while (left > 0) {
      // Rests break at beat boundaries so the bar reads conventionally.
      let cap = Math.min(left, roomInMeasure())
      const posInBeat = cursor % 4
      if (posInBeat !== 0) cap = Math.min(cap, 4 - posInBeat)
      const chunk = CHUNKS.find((c) => c <= cap) ?? 1
      m += `z${durSuffix(chunk)} `
      cursor += chunk
      left -= chunk
      if (cursor % TICKS_PER_MEASURE === 0) flushMeasure()
    }
  }

  const emitEvent = (ev: ChordEvent, letters: string) => {
    let left = ev.durTicks
    let first = true
    while (left > 0) {
      const chunk = CHUNKS.find((c) => c <= Math.min(left, roomInMeasure())) ?? 1
      const pitches = ev.midis.map((p) => abcPitch(p, key, measureState))
      const body =
        pitches.length === 1
          ? pitches[0] + durSuffix(chunk)
          : `[${pitches.join('')}]${durSuffix(chunk)}`
      const tie = left - chunk > 0 ? '-' : ''
      m += body + tie + ' '
      ly += (first ? letters : '_') + ' '
      cursor += chunk
      left -= chunk
      first = false
      if (cursor % TICKS_PER_MEASURE === 0) flushMeasure()
    }
  }

  for (const ev of events) {
    if (ev.startTick > cursor) emitRest(ev.startTick - cursor)
    const letters = ev.midis
      .map((p) => {
        const s = spell(p, key)
        return s.letter + (s.alt === 1 ? '\u266F' : s.alt === -1 ? '\u266D' : '')
      })
      .join('')
    emitEvent(ev, letters)
  }

  const total = totalMeasures * TICKS_PER_MEASURE
  if (cursor < total) emitRest(total - cursor)
  if (m.trim() !== '' || measures.length < totalMeasures) {
    if (m.trim() === '') m = 'z16'
    flushMeasure()
  }
  while (measures.length < totalMeasures) {
    measures.push('z16')
    lyrics.push('')
  }
  return { measures, lyrics }
}

function lastTick(notes: QuantizedNote[]): number {
  let end = 0
  for (const n of notes) end = Math.max(end, n.startTick + n.durTicks)
  return end
}

/** Full ABC document for a score: header, voices, letters, 4 bars per line. */
export function scoreToAbc(model: ScoreModel, title: string): string {
  const hasTreble = model.treble.length > 0
  const hasBass = model.bass.length > 0
  const totalMeasures = Math.max(
    1,
    Math.ceil(Math.max(lastTick(model.treble), lastTick(model.bass)) / TICKS_PER_MEASURE),
  )

  const header = [
    'X:1',
    `T:${title}`,
    'M:4/4',
    'L:1/16',
    `Q:1/4=${model.bpm}`,
    `K:${model.key}`,
  ]

  const lines: string[] = []

  const emitVoice = (
    tag: string,
    voice: VoiceLine,
    from: number,
    to: number,
  ) => {
    const bars = voice.measures.slice(from, to)
    const isLast = to >= totalMeasures
    lines.push(`${tag}${bars.join(' | ')} ${isLast ? '|]' : '|'}`)
    const ly = voice.lyrics.slice(from, to).join(' ').trim()
    lines.push(`w: ${ly}`)
  }

  if (hasTreble && hasBass) {
    header.push('%%score {(RH) (LH)}')
    header.push('V:RH clef=treble')
    header.push('V:LH clef=bass')
    const rh = voiceToAbc(model.treble, model.key, totalMeasures)
    const lh = voiceToAbc(model.bass, model.key, totalMeasures)
    for (let from = 0; from < totalMeasures; from += MEASURES_PER_LINE) {
      const to = Math.min(from + MEASURES_PER_LINE, totalMeasures)
      emitVoice('[V:RH] ', rh, from, to)
      emitVoice('[V:LH] ', lh, from, to)
    }
  } else {
    const notes = hasTreble ? model.treble : model.bass
    const clef = hasTreble ? 'treble' : 'bass'
    header.push(`V:1 clef=${clef}`)
    const v = voiceToAbc(notes, model.key, totalMeasures)
    for (let from = 0; from < totalMeasures; from += MEASURES_PER_LINE) {
      const to = Math.min(from + MEASURES_PER_LINE, totalMeasures)
      emitVoice('', v, from, to)
    }
  }

  return [...header, ...lines].join('\n') + '\n'
}
