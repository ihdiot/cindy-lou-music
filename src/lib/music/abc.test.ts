import { describe, expect, it } from 'vitest'
import { scoreToAbc, voiceToAbc } from './abc'
import type { ScoreModel } from './types'

const q = (midi: number, startTick: number, durTicks: number) => ({
  midi,
  startTick,
  durTicks,
})

describe('single staff engraving', () => {
  it('C D E quarters engrave as C4 D4 E4 with letters underneath', () => {
    const model: ScoreModel = {
      bpm: 120,
      key: 'C',
      treble: [q(60, 0, 4), q(62, 4, 4), q(64, 8, 4)],
      bass: [],
    }
    const abc = scoreToAbc(model, 'Test')
    expect(abc).toContain('L:1/16')
    expect(abc).toContain('V:1 clef=treble')
    // C4 = middle C for 4 ticks (a quarter), then rest fills the measure
    expect(abc).toContain('C4 D4 E4 z4')
    expect(abc).toContain('w: C D E')
    expect(abc).not.toContain('V:LH')
  })

  it('a low melody gets the bass clef', () => {
    const model: ScoreModel = {
      bpm: 100,
      key: 'C',
      treble: [],
      bass: [q(43, 0, 8), q(48, 8, 8)],
    }
    const abc = scoreToAbc(model, 'Low')
    expect(abc).toContain('V:1 clef=bass')
    expect(abc).toContain('w: G C')
  })
})

describe('grand staff engraving', () => {
  it('emits %%score exactly once with both voices', () => {
    const model: ScoreModel = {
      bpm: 120,
      key: 'C',
      treble: [q(72, 0, 4)],
      bass: [q(48, 0, 4)],
    }
    const abc = scoreToAbc(model, 'Both hands')
    expect(abc.match(/%%score/g)?.length).toBe(1)
    expect(abc).toContain('V:RH clef=treble')
    expect(abc).toContain('V:LH clef=bass')
    expect(abc).toContain('[V:RH]')
    expect(abc).toContain('[V:LH]')
  })

  it('both staves cover the same number of measures', () => {
    const model: ScoreModel = {
      bpm: 120,
      key: 'C',
      treble: [q(72, 0, 4), q(74, 28, 4)], // spills into measure 2
      bass: [q(48, 0, 4)],
    }
    const abc = scoreToAbc(model, 'Padding')
    const rh = abc.split('\n').filter((l) => l.startsWith('[V:RH]'))
    const lh = abc.split('\n').filter((l) => l.startsWith('[V:LH]'))
    expect(rh.length).toBe(lh.length)
    // LH must be padded with a whole-measure rest for measure 2
    expect(lh.join(' ')).toContain('z16')
  })
})

describe('rhythm plumbing', () => {
  it('ties a note across the barline', () => {
    const v = voiceToAbc([q(60, 12, 8)], 'C', 2)
    // 4 ticks in measure 1, tied to 4 ticks in measure 2
    expect(v.measures[0]).toContain('C4-')
    expect(v.measures[1]).toContain('C4')
    // the letter appears once; the tied tail holds with _
    expect(v.lyrics[0]).toContain('C')
    expect(v.lyrics[1]).toContain('_')
  })

  it('fills gaps with rests, letters skip the rests', () => {
    const v = voiceToAbc([q(60, 0, 2), q(64, 8, 2)], 'C', 1)
    expect(v.measures[0]).toBe('C2 z2 z4 E2 z2 z4'.trim())
    expect(v.lyrics[0]).toBe('C E')
  })

  it('chords engrave as one bracket with stacked letters', () => {
    const v = voiceToAbc([q(60, 0, 4), q(64, 0, 4), q(67, 0, 4)], 'C', 1)
    expect(v.measures[0]).toContain('[CEG]4')
    expect(v.lyrics[0]).toContain('CEG')
  })
})

describe('accidentals', () => {
  it('F# in C major carries a sharp mark', () => {
    const v = voiceToAbc([q(66, 0, 4)], 'C', 1)
    expect(v.measures[0]).toContain('^F4')
    expect(v.lyrics[0]).toContain('F\u266F')
  })

  it('F# in G major needs no mark (it is in the signature)', () => {
    const v = voiceToAbc([q(66, 0, 4)], 'G', 1)
    expect(v.measures[0]).toContain('F4')
    expect(v.measures[0]).not.toContain('^F4')
  })

  it('F natural after F# in the same measure gets a natural sign', () => {
    const v = voiceToAbc([q(66, 0, 4), q(65, 4, 4)], 'C', 1)
    expect(v.measures[0]).toContain('^F4')
    expect(v.measures[0]).toContain('=F4')
  })

  it('accidental state resets at the barline', () => {
    const v = voiceToAbc([q(66, 0, 16), q(66, 16, 4)], 'C', 2)
    expect(v.measures[0]).toContain('^F16')
    expect(v.measures[1]).toContain('^F4') // must be re-marked in the new measure
  })
})

describe('page layout', () => {
  it('wraps 32 measures into 8 systems of 4 bars', () => {
    const treble = Array.from({ length: 32 }, (_, i) => q(60 + (i % 8), i * 16, 16))
    const model: ScoreModel = { bpm: 120, key: 'C', treble, bass: [] }
    const abc = scoreToAbc(model, 'Long one')
    const musicLines = abc
      .split('\n')
      .filter((l) => /^[^%\w:]|^[A-Ga-gz[]/.test(l) && !l.startsWith('w:'))
      .filter((l) => l.includes('|'))
    expect(musicLines.length).toBe(8)
    // the last MUSIC line closes the piece (a w: letter line follows it)
    const lastMusic = musicLines[musicLines.length - 1]
    expect(lastMusic.trim().endsWith('|]')).toBe(true)
  })
})
