import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as tf from '@tensorflow/tfjs'
import { transcribeAudio } from './transcribe'
import { synthesize } from './synth'
import { detectPitchHz, hzToMidi } from './livePitch'
import { midiToHz } from './synth'
import { notesToScore } from '../music/pipeline'

/** Load Basic Pitch's model straight from node_modules for Node tests. */
function loadModelFromDisk(): Promise<tf.GraphModel> {
  const dir = 'node_modules/@spotify/basic-pitch/model'
  const json = JSON.parse(readFileSync(`${dir}/model.json`, 'utf8'))
  const bin = readFileSync(`${dir}/group1-shard1of1.bin`)
  return tf.loadGraphModel(
    tf.io.fromMemory({
      modelTopology: json.modelTopology,
      weightSpecs: json.weightsManifest.flatMap(
        (g: { weights: unknown[] }) => g.weights,
      ),
      weightData: bin.buffer.slice(
        bin.byteOffset,
        bin.byteOffset + bin.byteLength,
      ),
    }),
  )
}

const model = loadModelFromDisk()

describe('audio transcription (Basic Pitch)', () => {
  it(
    'the handoff fixture: C4 D4 E4 tones -> midi 60 62 64',
    { timeout: 120_000 },
    async () => {
      const audio = synthesize([
        { midi: 60, start: 0.2, duration: 0.45 },
        { midi: 62, start: 0.8, duration: 0.45 },
        { midi: 64, start: 1.4, duration: 0.45 },
      ])
      const notes = await transcribeAudio(audio, model)
      // Strongest three notes, in time order, must be exactly C D E.
      const top = [...notes]
        .sort((a, b) => b.velocity - a.velocity)
        .slice(0, 3)
        .sort((a, b) => a.start - b.start)
      expect(top.map((n) => n.midi)).toEqual([60, 62, 64])

      // And the full pipeline puts them on a treble staff.
      const score = notesToScore(notes)
      expect(score.treble.length).toBeGreaterThanOrEqual(3)
    },
  )

  it(
    'a C major chord is heard as C, E, G together',
    { timeout: 120_000 },
    async () => {
      const audio = synthesize([
        { midi: 60, start: 0.2, duration: 0.8 },
        { midi: 64, start: 0.2, duration: 0.8 },
        { midi: 67, start: 0.2, duration: 0.8 },
      ])
      const notes = await transcribeAudio(audio, model)
      const pitches = new Set(notes.map((n) => n.midi))
      expect(pitches.has(60)).toBe(true)
      expect(pitches.has(64)).toBe(true)
      expect(pitches.has(67)).toBe(true)
    },
  )
})

describe('live pitch detector (the big letters)', () => {
  it('names a held A4 (440Hz) correctly', () => {
    const rate = 48000
    const frame = new Float32Array(4096)
    for (let i = 0; i < frame.length; i++) {
      frame[i] = 0.4 * Math.sin((2 * Math.PI * 440 * i) / rate)
    }
    const hz = detectPitchHz(frame, rate)
    expect(hz).not.toBeNull()
    expect(hzToMidi(hz!)).toBe(69)
  })

  it('names middle C with piano-like harmonics correctly', () => {
    const rate = 48000
    const hz0 = midiToHz(60)
    const frame = new Float32Array(4096)
    for (let i = 0; i < frame.length; i++) {
      const t = i / rate
      frame[i] =
        0.3 * Math.sin(2 * Math.PI * hz0 * t) +
        0.2 * Math.sin(2 * Math.PI * hz0 * 2 * t) +
        0.1 * Math.sin(2 * Math.PI * hz0 * 3 * t)
    }
    const hz = detectPitchHz(frame, rate)
    expect(hz).not.toBeNull()
    expect(hzToMidi(hz!)).toBe(60)
  })

  it('stays quiet on silence', () => {
    expect(detectPitchHz(new Float32Array(4096), 48000)).toBeNull()
  })
})
