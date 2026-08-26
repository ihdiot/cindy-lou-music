/** A note as it was actually played (from MIDI or any other input). */
export interface NoteEvent {
  /** MIDI note number, e.g. 60 = middle C */
  midi: number
  /** Seconds from the start of the recording */
  start: number
  /** Seconds the note was held (pedal-extended when sustain was down) */
  duration: number
  /** 0..1 */
  velocity: number
}

/** A note after snapping to the rhythmic grid. Ticks are 16th notes. */
export interface QuantizedNote {
  midi: number
  startTick: number
  durTicks: number
}

/** Everything needed to engrave a page. */
export interface ScoreModel {
  bpm: number
  /** Major key name for the key signature, e.g. "C", "G", "Bb" */
  key: string
  treble: QuantizedNote[]
  bass: QuantizedNote[]
}

/** A saved take in IndexedDB. */
export interface SavedSong {
  id: string
  title: string
  createdAt: number
  notes: NoteEvent[]
}
