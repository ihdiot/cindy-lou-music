/** Played notes -> engraved score, one call. */
import type { NoteEvent, ScoreModel } from './types'
import { estimateGrid, quantize } from './quantize'
import { splitHands } from './hands'
import { detectKey } from './letters'

export function notesToScore(notes: NoteEvent[]): ScoreModel {
  const key = detectKey(notes.map((n) => n.midi))
  if (notes.length === 0) return { bpm: 90, key, treble: [], bass: [] }

  // Fit one tempo grid to everything played, then split hands on the raw
  // notes and quantize each hand against that same grid: the staves stay
  // aligned and a held bass note keeps its length under a moving melody.
  const grid = estimateGrid(notes)
  const { treble, bass } = splitHands(notes)
  return {
    bpm: Math.round(grid.bpm),
    key,
    treble: quantize(treble, grid.bpm, grid.anchor),
    bass: quantize(bass, grid.bpm, grid.anchor),
  }
}
