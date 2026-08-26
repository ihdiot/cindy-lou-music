import { describe, expect, it } from 'vitest'
import type { NoteEvent } from './types'
import { notesToScore } from './pipeline'
import { estimateBpm, estimateGrid, quantize } from './quantize'
import { splitHands } from './hands'

/** Play a sequence of midi numbers as steady quarter notes at 120 bpm. */
function playedQuarters(midis: number[], gap = 0.5, held = 0.42): NoteEvent[] {
  return midis.map((midi, i) => ({
    midi,
    start: i * gap,
    duration: held,
    velocity: 0.8,
  }))
}

describe('the mom fixture: C D E played slowly must come out C D E', () => {
  it('transcribes to midi 60 62 64 on the treble staff, no bass', () => {
    const score = notesToScore(playedQuarters([60, 62, 64]))
    expect(score.treble.map((n) => n.midi)).toEqual([60, 62, 64])
    expect(score.bass).toEqual([])
    expect(score.key).toBe('C')
  })

  it('survives human timing wobble (±60ms)', () => {
    const wobbled: NoteEvent[] = [
      { midi: 60, start: 0.0, duration: 0.44, velocity: 0.7 },
      { midi: 62, start: 0.55, duration: 0.4, velocity: 0.8 },
      { midi: 64, start: 1.02, duration: 0.46, velocity: 0.75 },
    ]
    const score = notesToScore(wobbled)
    expect(score.treble.map((n) => n.midi)).toEqual([60, 62, 64])
    const ticks = score.treble.map((n) => n.startTick)
    expect(ticks[0]).toBe(0)
    expect(ticks[1]).toBeGreaterThan(ticks[0])
    expect(ticks[2]).toBeGreaterThan(ticks[1])
  })
})

describe('grid fitting', () => {
  it('cancels symmetric human jitter back to the true tempo', () => {
    const jitter = [0.03, -0.02, 0.04, -0.03, 0.02, -0.04, 0.03, 0.01]
    const notes: NoteEvent[] = jitter.map((j, i) => ({
      midi: 60 + i,
      start: i * 0.5 + j,
      duration: 0.42,
      velocity: 0.8,
    }))
    const { bpm } = estimateGrid(notes)
    expect(Math.abs(bpm - 120)).toBeLessThan(2)
  })
})

describe('tempo estimation', () => {
  it('reads steady quarters at 0.5s apart as 120 bpm', () => {
    expect(estimateBpm(playedQuarters([60, 62, 64, 65, 67]))).toBe(120)
  })

  it('falls back to 90 for one or two notes', () => {
    expect(estimateBpm(playedQuarters([60]))).toBe(90)
    expect(estimateBpm(playedQuarters([60, 62]))).toBe(90)
  })
})

describe('quantize', () => {
  it('snaps chord members struck within 45ms to one moment', () => {
    const chord: NoteEvent[] = [
      { midi: 60, start: 1.0, duration: 0.5, velocity: 0.8 },
      { midi: 64, start: 1.02, duration: 0.5, velocity: 0.8 },
      { midi: 67, start: 1.03, duration: 0.48, velocity: 0.8 },
      { midi: 60, start: 2.0, duration: 0.5, velocity: 0.8 },
    ]
    const q = quantize(chord, 120)
    const starts = new Set(q.slice(0, 3).map((n) => n.startTick))
    expect(starts.size).toBe(1)
  })

  it('extends near-legato notes to meet the next note (no junk rests)', () => {
    // held 0.42 of a 0.5s gap at 120bpm -> should become a full quarter (4 ticks)
    const q = quantize(playedQuarters([60, 62, 64]), 120)
    expect(q[0].durTicks).toBe(4)
    expect(q[1].durTicks).toBe(4)
  })

  it('rounds the final note up to a clean value (no dotted-eighth endings)', () => {
    const q = quantize(playedQuarters([60, 62, 64]), 120)
    expect(q[2].durTicks).toBe(4)
  })

  it('keeps a genuinely short note short', () => {
    const staccato: NoteEvent[] = [
      { midi: 60, start: 0, duration: 0.12, velocity: 0.8 }, // ~1 tick at 120
      { midi: 62, start: 0.5, duration: 0.12, velocity: 0.8 },
      { midi: 64, start: 1.0, duration: 0.4, velocity: 0.8 },
    ]
    const q = quantize(staccato, 120)
    expect(q[0].durTicks).toBe(1)
  })
})

describe('hand split', () => {
  const q = (midis: number[]) =>
    midis.map((midi, i) => ({ midi, startTick: i * 4, durTicks: 4 }))

  it('keeps a G3-G4 one-hand scale on ONE staff', () => {
    const scale = q([55, 57, 59, 60, 62, 64, 65, 67])
    const { treble, bass } = splitHands(scale)
    expect(treble.length).toBe(8)
    expect(bass.length).toBe(0)
  })

  it('keeps a low melody entirely on the bass staff', () => {
    const low = q([43, 45, 47, 48])
    const { treble, bass } = splitHands(low)
    expect(bass.length).toBe(4)
    expect(treble.length).toBe(0)
  })

  it('never saws a left-hand chord in half (chord integrity beats pitch gaps)', () => {
    // LH plays C3+G3 chords (48+55) while RH plays a melody from 60 up.
    // The biggest pitch gap is inside the LH chord — the split must still
    // keep 48 and 55 together on the bass staff.
    const notes = [
      { midi: 48, startTick: 0, durTicks: 16 },
      { midi: 55, startTick: 0, durTicks: 16 },
      { midi: 64, startTick: 0, durTicks: 4 },
      { midi: 65, startTick: 4, durTicks: 4 },
      { midi: 67, startTick: 8, durTicks: 4 },
      { midi: 48, startTick: 16, durTicks: 16 },
      { midi: 55, startTick: 16, durTicks: 16 },
      { midi: 60, startTick: 16, durTicks: 4 },
    ]
    const { treble, bass } = splitHands(notes)
    expect(bass.map((n) => n.midi).sort((a, b) => a - b)).toEqual([48, 48, 55, 55])
    expect(treble.every((n) => n.midi >= 60)).toBe(true)
  })

  it('splits wide two-hand playing near middle C', () => {
    const twoHands = q([36, 40, 43, 60, 64, 67, 72])
    const { treble, bass } = splitHands(twoHands)
    expect(bass.map((n) => n.midi)).toEqual([36, 40, 43])
    expect(treble.map((n) => n.midi)).toEqual([60, 64, 67, 72])
  })
})

describe('two-hand end to end', () => {
  it('bass chords under a treble melody land on their own staves', () => {
    const notes: NoteEvent[] = []
    // LH: C major chord held each measure-ish; RH: melody
    for (let i = 0; i < 4; i++) {
      notes.push({ midi: 48, start: i * 2, duration: 1.9, velocity: 0.7 })
      notes.push({ midi: 52, start: i * 2 + 0.01, duration: 1.9, velocity: 0.7 })
      for (let j = 0; j < 4; j++) {
        notes.push({
          midi: [72, 74, 76, 77][j],
          start: i * 2 + j * 0.5,
          duration: 0.45,
          velocity: 0.8,
        })
      }
    }
    const score = notesToScore(notes)
    expect(score.bass.length).toBeGreaterThan(0)
    expect(score.treble.length).toBeGreaterThan(0)
    expect(Math.min(...score.treble.map((n) => n.midi))).toBeGreaterThanOrEqual(72)
    expect(Math.max(...score.bass.map((n) => n.midi))).toBeLessThanOrEqual(52)
  })
})
