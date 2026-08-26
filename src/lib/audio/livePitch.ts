/**
 * Lightweight live pitch detector (YIN-style) — DISPLAY ONLY.
 * Shows mom the letter of the note she's holding so she can trust the mic
 * before recording. The real transcription is Basic Pitch, after Stop.
 */

const MIN_HZ = 55 // A1
const MAX_HZ = 1800 // above C6 range with margin
const CLARITY = 0.16 // YIN threshold; lower = stricter

export function detectPitchHz(
  frame: Float32Array,
  sampleRate: number,
): number | null {
  const n = frame.length
  let energy = 0
  for (let i = 0; i < n; i++) energy += frame[i] * frame[i]
  if (energy / n < 1e-6) return null // silence

  const maxLag = Math.min(Math.floor(sampleRate / MIN_HZ), n - 1)
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ))

  // YIN difference function + cumulative mean normalization
  const d = new Float32Array(maxLag + 1)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < n - maxLag; i++) {
      const diff = frame[i] - frame[i + lag]
      sum += diff * diff
    }
    d[lag] = sum
  }
  let running = 0
  const cmndf = new Float32Array(maxLag + 1)
  cmndf[0] = 1
  for (let lag = minLag; lag <= maxLag; lag++) {
    running += d[lag]
    cmndf[lag] = running === 0 ? 1 : (d[lag] * (lag - minLag + 1)) / running
  }

  let bestLag = -1
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (cmndf[lag] < CLARITY) {
      while (lag + 1 <= maxLag && cmndf[lag + 1] < cmndf[lag]) lag++
      bestLag = lag
      break
    }
  }
  if (bestLag < 0) return null

  // Parabolic interpolation around the dip for sub-sample accuracy
  const a = cmndf[bestLag - 1] ?? cmndf[bestLag]
  const b = cmndf[bestLag]
  const c = cmndf[bestLag + 1] ?? cmndf[bestLag]
  const denom = a - 2 * b + c
  const shift = denom === 0 ? 0 : (0.5 * (a - c)) / denom
  return sampleRate / (bestLag + shift)
}

export function hzToMidi(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440))
}
