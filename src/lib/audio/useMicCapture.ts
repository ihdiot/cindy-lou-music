/**
 * React wrapper around MicRecorder + Basic Pitch transcription.
 * The microphone opens on first use (Start), never on page load.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { MicRecorder } from './recorder'
import { transcribeAudio } from './transcribe'
import type { NoteEvent } from '../music/types'

export type MicStatus = 'off' | 'opening' | 'ready' | 'denied'

export interface MicCapture {
  /** getUserMedia exists in this browser */
  available: boolean
  status: MicStatus
  /** live input loudness 0..1 — the "I can hear you" meter */
  level: number
  /** live detected note for the big letters (display only) */
  midi: number | null
  ensureOpen: () => Promise<boolean>
  startRecording: () => void
  /** stop + transcribe. Empty array = heard nothing usable. */
  stopRecording: () => Promise<NoteEvent[]>
}

export function useMicCapture(): MicCapture {
  const recorder = useRef<MicRecorder | null>(null)
  const [status, setStatus] = useState<MicStatus>('off')
  const [level, setLevel] = useState(0)
  const [midi, setMidi] = useState<number | null>(null)

  const available =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    return () => {
      recorder.current?.close()
      recorder.current = null
    }
  }, [])

  const ensureOpen = useCallback(async (): Promise<boolean> => {
    if (recorder.current) return true
    setStatus('opening')
    const rec = new MicRecorder()
    try {
      await rec.open()
    } catch {
      setStatus('denied')
      return false
    }
    rec.onReading = (r) => {
      setLevel(r.level)
      setMidi(r.midi)
    }
    recorder.current = rec
    setStatus('ready')
    return true
  }, [])

  const startRecording = useCallback(() => {
    recorder.current?.startRecording()
  }, [])

  const stopRecording = useCallback(async (): Promise<NoteEvent[]> => {
    const rec = recorder.current
    if (!rec) return []
    const samples = await rec.stopRecording()
    // Less than a third of a second of audio can't hold a note.
    if (samples.length < 7350) return []
    const notes = await transcribeAudio(samples)
    return notes
  }, [])

  return { available, status, level, midi, ensureOpen, startRecording, stopRecording }
}
