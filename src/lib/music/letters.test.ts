import { describe, expect, it } from 'vitest'
import { detectKey, letterName, spell } from './letters'

describe('letter names (what mom reads)', () => {
  it('names the white keys plainly, no octave numbers', () => {
    expect(letterName(60)).toBe('C')
    expect(letterName(62)).toBe('D')
    expect(letterName(64)).toBe('E')
    expect(letterName(65)).toBe('F')
    expect(letterName(67)).toBe('G')
    expect(letterName(69)).toBe('A')
    expect(letterName(71)).toBe('B')
    expect(letterName(48)).toBe('C') // same letter an octave down
  })

  it('names sharps with the sharp sign in sharp keys', () => {
    expect(letterName(66, 'G')).toBe('F\u266F')
    expect(letterName(61, 'D')).toBe('C\u266F')
  })

  it('names flats with the flat sign in flat keys', () => {
    expect(letterName(70, 'F')).toBe('B\u266D')
    expect(letterName(63, 'Bb')).toBe('E\u266D')
  })
})

describe('spelling octaves', () => {
  it('middle C is octave 4 and C#4 stays octave 4', () => {
    expect(spell(60, 'C')).toEqual({ letter: 'C', alt: 0, octave: 4 })
    expect(spell(61, 'C')).toEqual({ letter: 'C', alt: 1, octave: 4 })
  })
  it('Db4 (flat spelling) is also octave 4', () => {
    expect(spell(61, 'F')).toEqual({ letter: 'D', alt: -1, octave: 4 })
  })
})

describe('key detection', () => {
  it('C major scale -> C', () => {
    expect(detectKey([60, 62, 64, 65, 67, 69, 71, 72])).toBe('C')
  })
  it('G major scale (with F#) -> G', () => {
    expect(detectKey([67, 69, 71, 72, 74, 76, 78, 79])).toBe('G')
  })
  it('F major melody (with Bb) -> F', () => {
    expect(detectKey([65, 67, 69, 70, 72, 74, 76, 77])).toBe('F')
  })
  it('empty input defaults to C', () => {
    expect(detectKey([])).toBe('C')
  })
})
