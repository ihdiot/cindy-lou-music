import type { SavedSong } from '../lib/music/types'

export function SongList({
  songs,
  onOpen,
  onDelete,
}: {
  songs: SavedSong[]
  onOpen: (song: SavedSong) => void
  onDelete: (id: string) => void
}) {
  if (songs.length === 0) return null
  return (
    <section className="no-print mt-14">
      <h2 className="mb-3 text-2xl font-semibold text-forest">
        Your saved songs
      </h2>
      <ul className="space-y-2">
        {songs.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-2xl border border-forest/10 bg-parchment px-6 py-3 shadow-sm"
          >
            <button
              className="text-left text-xl text-forest hover:underline"
              onClick={() => onOpen(s)}
            >
              {s.title}
              <span className="ml-3 text-base italic text-forest/50">
                {new Date(s.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </button>
            <button
              className="rounded-lg px-3 py-1 text-sm text-berry hover:bg-berry/10"
              onClick={() => onDelete(s.id)}
              aria-label={`Delete ${s.title}`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
