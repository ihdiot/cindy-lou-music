import { letterName } from '../lib/music/letters'

/**
 * The huge letters shown while keys are held.
 * If this says E while she presses C, something is wrong with the keyboard
 * hookup — the page can never be righter than these letters.
 */
export function LiveLetters({ held }: { held: number[] }) {
  if (held.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center text-2xl italic text-forest/40">
        Press a piano key — its name appears here
      </div>
    )
  }
  return (
    <div
      className="flex h-36 items-center justify-center gap-6"
      data-testid="live-letters"
    >
      {held.map((m) => (
        <span
          key={m}
          className="text-9xl font-semibold text-forest drop-shadow-[0_2px_2px_rgba(29,59,40,0.15)]"
          data-midi={m}
        >
          {letterName(m)}
        </span>
      ))}
    </div>
  )
}
