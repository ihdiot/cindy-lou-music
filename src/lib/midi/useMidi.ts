/**
 * Web MIDI capture for the Alesis Melody 61 (or any class-compliant keyboard).
 *
 * - Auto-connects to every MIDI input; hot-plug handled via onstatechange.
 * - Sustain pedal (CC64) extends note durations, like real notation should.
 * - Exposes window.__cindy so tests can inject notes without hardware.
 */
import { useEffect, useRef, useState } from 'react'
import type { NoteEvent } from '../music/types'

export interface MidiState {
  /** Browser supports Web MIDI at all */
  supported: boolean
  /** The browser refused MIDI access (she clicked Block) */
  blocked: boolean
  /** Names of connected MIDI inputs */
  inputs: string[]
  /** midi numbers currently pressed (for the big live letters) */
  held: number[]
}

interface OpenNote {
  midi: number
  start: number
  velocity: number
}

export interface MidiCapture extends MidiState {
  startRecording: () => void
  /** Returns everything played since startRecording. */
  stopRecording: () => NoteEvent[]
}

declare global {
  interface Window {
    __cindy?: {
      noteOn: (midi: number, velocity?: number) => void
      noteOff: (midi: number) => void
      pedal: (down: boolean) => void
      /** Pretend a keyboard is connected (tests have no hardware). */
      plug: (name?: string) => void
    }
  }
}

export function useMidi(): MidiCapture {
  const [supported, setSupported] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [inputs, setInputs] = useState<string[]>([])
  const [held, setHeld] = useState<number[]>([])

  const recording = useRef(false)
  const t0 = useRef(0)
  const open = useRef(new Map<number, OpenNote>())
  const sustained = useRef(new Map<number, OpenNote>())
  const pedalDown = useRef(false)
  const captured = useRef<NoteEvent[]>([])

  useEffect(() => {
    const now = () => performance.now() / 1000

    const closeNote = (n: OpenNote) => {
      if (!recording.current) return
      captured.current.push({
        midi: n.midi,
        start: n.start - t0.current,
        duration: Math.max(0.05, now() - n.start),
        velocity: n.velocity,
      })
    }

    const noteOn = (midi: number, velocity = 0.8) => {
      // Re-strike while sustained: close the old ring first.
      const ringing = sustained.current.get(midi)
      if (ringing) {
        closeNote(ringing)
        sustained.current.delete(midi)
      }
      open.current.set(midi, { midi, start: now(), velocity })
      setHeld((h) => (h.includes(midi) ? h : [...h, midi].sort((a, b) => a - b)))
    }

    const noteOff = (midi: number) => {
      const n = open.current.get(midi)
      if (n) {
        open.current.delete(midi)
        if (pedalDown.current) sustained.current.set(midi, n)
        else closeNote(n)
      }
      setHeld((h) => h.filter((x) => x !== midi))
    }

    const pedal = (down: boolean) => {
      pedalDown.current = down
      if (!down) {
        for (const n of sustained.current.values()) closeNote(n)
        sustained.current.clear()
      }
    }

    const onMessage = (e: Event) => {
      const data = (e as MIDIMessageEvent).data
      if (!data || data.length < 2) return
      const cmd = data[0] & 0xf0
      if (cmd === 0x90 && data[2] > 0) noteOn(data[1], data[2] / 127)
      else if (cmd === 0x80 || (cmd === 0x90 && data[2] === 0)) noteOff(data[1])
      else if (cmd === 0xb0 && data[1] === 64) pedal(data[2] >= 64)
    }

    window.__cindy = {
      noteOn,
      noteOff,
      pedal,
      plug: (name = 'Test keyboard') =>
        setInputs((i) => (i.includes(name) ? i : [...i, name])),
    }

    if (!('requestMIDIAccess' in navigator)) {
      setSupported(false)
      return
    }

    let access: MIDIAccess | null = null
    const refresh = () => {
      if (!access) return
      const names: string[] = []
      access.inputs.forEach((input) => {
        names.push(input.name ?? 'MIDI keyboard')
        input.onmidimessage = onMessage
      })
      setInputs(names)
    }

    navigator
      .requestMIDIAccess({ sysex: false })
      .then((a) => {
        access = a
        a.onstatechange = refresh
        refresh()
      })
      .catch(() => setBlocked(true))

    return () => {
      if (access) {
        access.onstatechange = null
        access.inputs.forEach((input) => {
          input.onmidimessage = null
        })
      }
      delete window.__cindy
    }
  }, [])

  const startRecording = () => {
    captured.current = []
    open.current.clear()
    sustained.current.clear()
    t0.current = performance.now() / 1000
    recording.current = true
  }

  const stopRecording = (): NoteEvent[] => {
    const now = performance.now() / 1000
    // Anything still held or ringing counts, ended at Stop.
    for (const n of [...open.current.values(), ...sustained.current.values()]) {
      captured.current.push({
        midi: n.midi,
        start: n.start - t0.current,
        duration: Math.max(0.05, now - n.start),
        velocity: n.velocity,
      })
    }
    open.current.clear()
    sustained.current.clear()
    recording.current = false
    const out = [...captured.current].sort((a, b) => a.start - b.start)
    captured.current = []
    return out
  }

  return { supported, blocked, inputs, held, startRecording, stopRecording }
}
