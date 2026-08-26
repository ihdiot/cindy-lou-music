/**
 * Audio -> notes via Spotify Basic Pitch (an ML model trained for exactly
 * this). Loaded lazily so keyboards with real MIDI never download it.
 *
 * Honest expectations: melodies transcribe well; dense two-hand playing is
 * a good draft. This replaces nothing about the MIDI path — it is the
 * fallback for keyboards (like mom's Melody 61) that have no data output.
 */
import type * as tf from '@tensorflow/tfjs'
import type { NoteEvent } from '../music/types'

/** Basic Pitch's expected input sample rate. */
export const BP_SAMPLE_RATE = 22050

/** Piano range guard — anything outside is a transcription artifact. */
const MIDI_LO = 21
const MIDI_HI = 108

export async function transcribeAudio(
  samples: Float32Array,
  model?: string | Promise<tf.GraphModel>,
): Promise<NoteEvent[]> {
  const bp = await import('@spotify/basic-pitch')
  const modelSource =
    model ?? `${import.meta.env.BASE_URL ?? '/'}model/model.json`
  const basicPitch = new bp.BasicPitch(modelSource)

  const frames: number[][] = []
  const onsets: number[][] = []
  const contours: number[][] = []
  await basicPitch.evaluateModel(
    samples,
    (f, o, c) => {
      frames.push(...f)
      onsets.push(...o)
      contours.push(...c)
    },
    () => {},
  )

  const notes = bp.noteFramesToTime(
    bp.addPitchBendsToNoteEvents(
      contours,
      bp.outputToNotesPoly(frames, onsets, 0.5, 0.3, 11),
    ),
  )

  return notes
    .filter((n) => n.pitchMidi >= MIDI_LO && n.pitchMidi <= MIDI_HI)
    .map((n) => ({
      midi: n.pitchMidi,
      start: n.startTimeSeconds,
      duration: Math.max(0.05, n.durationSeconds),
      velocity: Math.min(1, n.amplitude),
    }))
    .sort((a, b) => a.start - b.start)
}
