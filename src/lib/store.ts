/**
 * Saved songs live in IndexedDB under the legacy name "bench-notes".
 * Do NOT rename the database — that would orphan existing songs.
 */
import type { SavedSong } from './music/types'

const DB_NAME = 'bench-notes'
const STORE = 'takes'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

export function saveSong(song: SavedSong): Promise<IDBValidKey> {
  return tx('readwrite', (s) => s.put(song))
}

export async function listSongs(): Promise<SavedSong[]> {
  const all = await tx<SavedSong[]>('readonly', (s) => s.getAll())
  return all
    .filter((s) => Array.isArray(s.notes))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function deleteSong(id: string): Promise<undefined> {
  return tx('readwrite', (s) => s.delete(id))
}
