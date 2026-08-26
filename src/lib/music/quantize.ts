/**
 * Turn played NoteEvents (real, messy timing) into grid-snapped notes.
 * Ticks are 16th notes; 16 ticks per 4/4 measure.
 */
import type { NoteEvent, QuantizedNote } from './types'

/** Onsets closer together than this are one musical moment (a chord). */
const CLUSTER_S = 0.045

export function clusterOnsets(notes: NoteEvent[]): number[] {
  const starts = [...notes].map((n) => n.start).sort((a, b) => a - b)
  const clusters: number[] = []
  for (const s of starts) {
    if (clusters.length === 0 || s - clusters[clusters.length - 1] > CLUSTER_S) {
      clusters.push(s)
    }
  }
  return clusters
}

/**
 * Estimate tempo from the gaps between played moments.
 * The median gap is assumed to be a simple subdivision of the beat;
 * we pick the reading that lands nearest a comfortable 100 bpm.
 */
export function estimateBpm(notes: NoteEvent[]): number {
  const onsets = clusterOnsets(notes)
  if (onsets.length < 3) return 90
  const iois: number[] = []
  for (let i = 1; i < onsets.length; i++) {
    const d = onsets[i] - onsets[i - 1]
    if (d > 0.08 && d < 4) iois.push(d)
  }
  if (iois.length === 0) return 90
  iois.sort((a, b) => a - b)
  const median = iois[Math.floor(iois.length / 2)]
  // Average every gap that resembles the typical one (rejects long pauses
  // and stray subdivisions) — jitter cancels out in the mean.
  const alike = iois.filter((d) => d > 0.72 * median && d < 1.28 * median)
  const m = alike.reduce((a, b) => a + b, 0) / alike.length
  let best = 90
  let bestDist = Infinity
  for (const beatsPerGap of [0.25, 0.5, 1, 2]) {
    const bpm = (60 * beatsPerGap) / m
    if (bpm < 40 || bpm > 200) continue
    const dist = Math.abs(bpm - 100)
    if (dist < bestDist) {
      bestDist = dist
      best = bpm
    }
  }
  return Math.round(best)
}

/**
 * Refine the raw bpm guess by least-squares fitting the 16th-note grid to
 * every played onset. A human's jitter is roughly symmetric, so the fitted
 * grid cancels it out instead of letting one rushed note bend the tempo.
 */
export function estimateGrid(notes: NoteEvent[]): { bpm: number; anchor: number } {
  const bpm0 = estimateBpm(notes)
  const onsets = clusterOnsets(notes)
  if (onsets.length < 3) return { bpm: bpm0, anchor: onsets[0] ?? 0 }
  let tick = 60 / bpm0 / 4
  let anchor = onsets[0]
  for (let iter = 0; iter < 2; iter++) {
    const ks = onsets.map((t) => Math.round((t - anchor) / tick))
    const kMean = ks.reduce((a, b) => a + b, 0) / ks.length
    const tMean = onsets.reduce((a, b) => a + b, 0) / onsets.length
    let num = 0
    let den = 0
    for (let i = 0; i < ks.length; i++) {
      num += (ks[i] - kMean) * (onsets[i] - tMean)
      den += (ks[i] - kMean) ** 2
    }
    if (den === 0) break
    const fitted = num / den
    if (!(fitted > 0.02 && fitted < 1)) break
    tick = fitted
    anchor = tMean - tick * kMean
  }
  return { bpm: 60 / (4 * tick), anchor }
}

/** Durations that engrave as clean notes (16th .. whole, with dots). */
const NICE_TICKS = [1, 2, 3, 4, 6, 8, 12, 16]

function nearestNice(t: number): number {
  let best = NICE_TICKS[0]
  for (const n of NICE_TICKS) {
    if (Math.abs(n - t) < Math.abs(best - t)) best = n
  }
  return best
}

/**
 * The final note of a take has no "next onset" to lean on; round it UP to a
 * clean value so the song doesn't end on a fussy dotted-eighth-plus-rests.
 */
function lastNoteTicks(raw: number): number {
  for (const n of [1, 2, 4, 6, 8, 12, 16]) {
    if (n >= raw * 0.85) return n
  }
  return 16
}

/**
 * Snap notes to the 16th grid.
 * - Chord members (starts within CLUSTER_S) share a startTick.
 * - A note that fills most of the gap to the next moment is extended to
 *   meet it (real playing is never perfectly legato; avoid junk rests).
 * - Pass the same `anchor` (recording's first onset) for both hands so the
 *   two staves stay aligned.
 */
export function quantize(
  notes: NoteEvent[],
  bpm: number,
  anchorOverride?: number,
): QuantizedNote[] {
  if (notes.length === 0) return []
  const tick = 60 / bpm / 4
  const clusters = clusterOnsets(notes)
  const anchor = anchorOverride ?? clusters[0]

  const clusterOf = (start: number): number => {
    let best = clusters[0]
    for (const c of clusters) {
      if (Math.abs(c - start) < Math.abs(best - start)) best = c
    }
    return best
  }

  const clusterTicks = new Map<number, number>()
  for (const c of clusters) {
    clusterTicks.set(c, Math.max(0, Math.round((c - anchor) / tick)))
  }
  const sortedTicks = [...new Set([...clusterTicks.values()])].sort((a, b) => a - b)

  const out: QuantizedNote[] = []
  for (const n of [...notes].sort((a, b) => a.start - b.start)) {
    const startTick = clusterTicks.get(clusterOf(n.start)) ?? 0
    const rawDur = n.duration / tick
    const next = sortedTicks.find((t) => t > startTick)
    let durTicks: number
    if (next !== undefined) {
      const gap = next - startTick
      // Fills most of the way to the next moment -> treat as legato.
      durTicks = rawDur >= 0.55 * gap ? gap : nearestNice(rawDur)
      durTicks = Math.min(durTicks, gap)
    } else {
      durTicks = lastNoteTicks(rawDur)
    }
    out.push({ midi: n.midi, startTick, durTicks: Math.max(1, durTicks) })
  }
  return out
}
