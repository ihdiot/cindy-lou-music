/**
 * Microphone / line-in capture.
 *
 * - Raw PCM via AudioWorklet (no MediaRecorder, no codec decode hangs —
 *   the exact trap the old Grok build fell into).
 * - Echo cancellation / noise suppression OFF: those filters are built to
 *   destroy exactly the kind of steady tones a piano makes.
 * - Live level + live YIN pitch for the big letters while she plays.
 * - stop() resamples everything to 22050 Hz for Basic Pitch.
 */
import { BP_SAMPLE_RATE } from './transcribe'
import { detectPitchHz, hzToMidi } from './livePitch'

const WORKLET_SOURCE = `
class PcmTap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) this.port.postMessage(ch.slice(0))
    return true
  }
}
registerProcessor('pcm-tap', PcmTap)
`

export interface LiveReading {
  /** 0..1-ish RMS level — drives the "I can hear you" indicator */
  level: number
  /** Detected midi note, or null when unclear/silent */
  midi: number | null
}

export class MicRecorder {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private chunks: Float32Array[] = []
  private analysisBuf = new Float32Array(4096)
  private analysisFill = 0
  private lastMidi: number | null = null
  private stableCount = 0
  private recording = false

  onReading: ((r: LiveReading) => void) | null = null

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000
  }

  async open(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    this.ctx = new AudioContext()
    await this.ctx.resume()
    const workletUrl = URL.createObjectURL(
      new Blob([WORKLET_SOURCE], { type: 'application/javascript' }),
    )
    await this.ctx.audioWorklet.addModule(workletUrl)
    URL.revokeObjectURL(workletUrl)

    const source = this.ctx.createMediaStreamSource(this.stream)
    const tap = new AudioWorkletNode(this.ctx, 'pcm-tap')
    source.connect(tap)
    tap.port.onmessage = (e: MessageEvent<Float32Array>) => {
      this.ingest(e.data)
    }
  }

  private ingest(chunk: Float32Array) {
    if (this.recording) this.chunks.push(chunk)

    // Fill the analysis window; when full, report level + pitch.
    let offset = 0
    while (offset < chunk.length) {
      const room = this.analysisBuf.length - this.analysisFill
      const take = Math.min(room, chunk.length - offset)
      this.analysisBuf.set(chunk.subarray(offset, offset + take), this.analysisFill)
      this.analysisFill += take
      offset += take
      if (this.analysisFill === this.analysisBuf.length) {
        this.analyze()
        this.analysisFill = 0
      }
    }
  }

  private analyze() {
    let energy = 0
    for (let i = 0; i < this.analysisBuf.length; i++) {
      energy += this.analysisBuf[i] * this.analysisBuf[i]
    }
    const level = Math.min(1, Math.sqrt(energy / this.analysisBuf.length) * 8)

    let midi: number | null = null
    const hz = detectPitchHz(this.analysisBuf, this.sampleRate)
    if (hz !== null) {
      const m = hzToMidi(hz)
      // Require two agreeing windows before showing a letter (kills flicker).
      if (m === this.lastMidi) this.stableCount++
      else this.stableCount = 0
      this.lastMidi = m
      if (this.stableCount >= 1) midi = m
    } else {
      this.lastMidi = null
      this.stableCount = 0
    }
    this.onReading?.({ level, midi })
  }

  startRecording() {
    this.chunks = []
    this.recording = true
  }

  /** Returns all recorded audio resampled to Basic Pitch's 22050 Hz. */
  async stopRecording(): Promise<Float32Array> {
    this.recording = false
    const total = this.chunks.reduce((a, c) => a + c.length, 0)
    if (total === 0) return new Float32Array(0)
    const joined = new Float32Array(total)
    let at = 0
    for (const c of this.chunks) {
      joined.set(c, at)
      at += c.length
    }
    this.chunks = []
    return resampleTo(joined, this.sampleRate, BP_SAMPLE_RATE)
  }

  close() {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.ctx?.close().catch(() => {})
    this.ctx = null
    this.stream = null
  }
}

async function resampleTo(
  samples: Float32Array<ArrayBuffer>,
  fromRate: number,
  toRate: number,
): Promise<Float32Array> {
  if (fromRate === toRate) return samples
  const frames = Math.ceil((samples.length * toRate) / fromRate)
  const offline = new OfflineAudioContext(1, frames, toRate)
  const buffer = offline.createBuffer(1, samples.length, fromRate)
  buffer.copyToChannel(samples, 0)
  const src = offline.createBufferSource()
  src.buffer = buffer
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}
