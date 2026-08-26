/**
 * Note spelling and key detection.
 * Letters are what mom reads: C, D, E, F♯, B♭ — no octave numbers.
 */

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/** Major keys we detect, mapped to sharps (+) or flats (-) in the signature. */
export const KEYS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5,
}

const SHARP_ORDER: Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER: Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

const TONIC_PC: Record<string, number> = {
  C: 0, G: 7, D: 2, A: 9, E: 4, B: 11, F: 5, Bb: 10, Eb: 3, Ab: 8, Db: 1,
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]

/** letter -> -1/0/+1 for the key signature of a major key */
export function keySignature(key: string): Record<Letter, number> {
  const sig: Record<Letter, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 }
  const n = KEYS[key] ?? 0
  if (n > 0) for (let i = 0; i < n; i++) sig[SHARP_ORDER[i]] = 1
  if (n < 0) for (let i = 0; i < -n; i++) sig[FLAT_ORDER[i]] = -1
  return sig
}

export function scalePcs(key: string): Set<number> {
  const t = TONIC_PC[key] ?? 0
  return new Set(MAJOR_STEPS.map((s) => (s + t) % 12))
}

/**
 * Pick the major key that explains the most played notes.
 * Ties go to the simpler signature, then to C.
 */
export function detectKey(midis: number[]): string {
  if (midis.length === 0) return 'C'
  const counts = new Array(12).fill(0)
  for (const m of midis) counts[((m % 12) + 12) % 12]++
  let best = 'C'
  let bestScore = -1
  const names = Object.keys(KEYS).sort(
    (a, b) => Math.abs(KEYS[a]) - Math.abs(KEYS[b]),
  )
  for (const key of names) {
    const pcs = scalePcs(key)
    let score = 0
    for (let pc = 0; pc < 12; pc++) if (pcs.has(pc)) score += counts[pc]
    if (score > bestScore) {
      bestScore = score
      best = key
    }
  }
  return best
}

export interface Spelled {
  letter: Letter
  /** -1 flat, 0 natural, +1 sharp */
  alt: number
  /** Scientific octave of the spelled letter (middle C = octave 4) */
  octave: number
}

const SHARP_SPELL: Array<[Letter, number]> = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
]
const FLAT_SPELL: Array<[Letter, number]> = [
  ['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0],
  ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0],
]

/** Spell a midi number in the context of a key (sharp keys name F♯, flat keys name B♭). */
export function spell(midi: number, key: string): Spelled {
  const useFlats = (KEYS[key] ?? 0) < 0
  const pc = ((midi % 12) + 12) % 12
  const [letter, alt] = (useFlats ? FLAT_SPELL : SHARP_SPELL)[pc]
  // The octave belongs to the letter: C♯4 and D♭4 are both midi 61.
  const naturalMidi = midi - alt
  const octave = Math.floor(naturalMidi / 12) - 1
  return { letter, alt, octave }
}

/** Mom-readable name: "C", "F♯", "B♭" — octave omitted on purpose. */
export function letterName(midi: number, key = 'C'): string {
  const s = spell(midi, key)
  return s.letter + (s.alt === 1 ? '\u266F' : s.alt === -1 ? '\u266D' : '')
}
