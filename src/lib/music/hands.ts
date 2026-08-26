/**
 * Decide which notes belong on the treble staff (right hand) and which on
 * the bass staff (left hand). Works on raw notes (start, seconds) or
 * quantized notes (startTick), so the split can happen BEFORE quantizing —
 * each hand then keeps its own rhythm.
 */

export interface HandSplit<T> {
  treble: T[]
  bass: T[]
}

interface TimeLike {
  midi: number
  start?: number
  startTick?: number
}

const timeOf = (n: TimeLike) => n.start ?? n.startTick ?? 0

/** One hand can reach about an octave within a single chord. */
const HAND_SPAN = 12
/** Struck this close together (seconds or ticks) = one moment. */
const SAME_MOMENT = 0.05

/** Group notes into simultaneous "moments" (chords across both hands). */
function moments<T extends TimeLike>(notes: T[]): number[][] {
  const sorted = [...notes].sort((a, b) => timeOf(a) - timeOf(b))
  const out: number[][] = []
  let current: number[] = []
  let lastT = -Infinity
  for (const n of sorted) {
    const t = timeOf(n)
    if (t - lastT > SAME_MOMENT && current.length > 0) {
      out.push(current)
      current = []
    }
    current.push(n.midi)
    lastT = t
  }
  if (current.length > 0) out.push(current)
  return out
}

/**
 * How many chords would this split point saw in half?
 * A chord is "sawn" when two notes struck together, close enough to be one
 * hand (<= HAND_SPAN), end up on opposite staves.
 */
function chordViolations(split: number, chords: number[][]): number {
  let v = 0
  for (const chord of chords) {
    const below = chord.filter((p) => p < split)
    const above = chord.filter((p) => p >= split)
    if (below.length === 0 || above.length === 0) continue
    const hi = Math.max(...below)
    const lo = Math.min(...above)
    if (lo - hi <= HAND_SPAN) v++
  }
  return v
}

/**
 * - A narrow melody stays on ONE staff (a G3-G4 scale must not be sawn in
 *   half at middle C).
 * - Wide two-handed playing splits near middle C. Candidate split points
 *   are middle C plus every sizable pitch gap in the middle register; the
 *   winner breaks the fewest simultaneous chords, ties going to the split
 *   nearest middle C.
 */
export function splitHands<T extends TimeLike>(notes: T[]): HandSplit<T> {
  if (notes.length === 0) return { treble: [], bass: [] }

  const pitches = [...new Set(notes.map((n) => n.midi))].sort((a, b) => a - b)
  const lo = pitches[0]
  const hi = pitches[pitches.length - 1]

  // Fits on one staff (about two octaves of reach) -> keep it together.
  if (hi - lo <= 16) {
    const median = pitches[Math.floor(pitches.length / 2)]
    return median >= 57
      ? { treble: notes, bass: [] }
      : { treble: [], bass: notes }
  }

  const candidates = new Set<number>([60])
  for (let i = 1; i < pitches.length; i++) {
    const gap = pitches[i] - pitches[i - 1]
    const mid = Math.round((pitches[i] + pitches[i - 1]) / 2)
    if (gap >= 4 && mid >= 48 && mid <= 72) candidates.add(mid)
  }

  const chords = moments(notes).filter((c) => c.length > 1)

  // Middle C is the piano convention; an alternative split must be CLEARLY
  // better (2+ fewer sawn chords) to override it. Otherwise a melody that
  // dips to middle C over a ringing chord gets its note stolen by the bass.
  const baseV = chordViolations(60, chords)
  let split = 60
  let bestV = baseV
  for (const c of [...candidates].sort((a, b) => Math.abs(a - 60) - Math.abs(b - 60))) {
    if (c === 60) continue
    const v = chordViolations(c, chords)
    if (v <= baseV - 2 && v < bestV) {
      bestV = v
      split = c
    }
  }

  const treble: T[] = []
  const bass: T[] = []
  for (const n of notes) (n.midi >= split ? treble : bass).push(n)
  return { treble, bass }
}
