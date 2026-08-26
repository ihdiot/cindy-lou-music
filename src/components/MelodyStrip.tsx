import type { ScoreModel } from '../lib/music/types'
import { letterName } from '../lib/music/letters'

/**
 * Every note of the song, in playing order, as letter chips.
 * Treble notes are green, bass notes are dark — all of them listed,
 * letters only (C, not C4).
 */
export function MelodyStrip({ score }: { score: ScoreModel }) {
  const all = [
    ...score.treble.map((n) => ({ ...n, hand: 'treble' as const })),
    ...score.bass.map((n) => ({ ...n, hand: 'bass' as const })),
  ].sort((a, b) => a.startTick - b.startTick || a.midi - b.midi)

  if (all.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2" data-testid="melody-strip">
      {all.map((n, i) => (
        <span
          key={`${n.startTick}-${n.midi}-${i}`}
          data-hand={n.hand}
          className={
            'inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-xl font-semibold shadow-sm ' +
            (n.hand === 'treble'
              ? 'bg-forest text-cream ring-1 ring-brass/40'
              : 'bg-parchment text-forest ring-1 ring-forest/20')
          }
        >
          {letterName(n.midi, score.key)}
        </span>
      ))}
    </div>
  )
}
