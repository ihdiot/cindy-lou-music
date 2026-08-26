/**
 * Synthetic piano-ish tones for testing the transcription without a real
 * piano: fundamental + decaying harmonics + exponential envelope.
 */
import { BP_SAMPLE_RATE } from './transcribe'

const HARMONICS = [1, 0.55, 0.3, 0.15, 0.08]

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Render a sequence of notes (seconds-based) into one mono buffer. */
export function synthesize(
  notes: Array<{ midi: number; start: number; duration: number }>,
  sampleRate = BP_SAMPLE_RATE,
  tailSeconds = 0.5,
): Float32Array {
  const end =
    Math.max(...notes.map((n) => n.start + n.duration)) + tailSeconds
  const out = new Float32Array(Math.ceil(end * sampleRate))
  for (const note of notes) {
    const hz = midiToHz(note.midi)
    const from = Math.floor(note.start * sampleRate)
    const len = Math.floor(note.duration * sampleRate)
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate
      const attack = Math.min(1, t / 0.01)
      const decay = Math.exp(-t * 1.5)
      let s = 0
      for (let h = 0; h < HARMONICS.length; h++) {
        s += HARMONICS[h] * Math.sin(2 * Math.PI * hz * (h + 1) * t)
      }
      out[from + i] += 0.25 * attack * decay * s
    }
  }
  return out
}
