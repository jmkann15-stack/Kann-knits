import { useLiveQuery } from 'dexie-react-hooks'

// Remembers the last result of each live query for this session, so coming
// back to a screen shows its content straight away (then refreshes) instead
// of drawing an empty or wrong layout for a frame while IndexedDB answers.

const cache = new Map<string, unknown>()

export function useCachedLiveQuery<T>(key: string, query: () => Promise<T>, deps: unknown[]): T | undefined {
  const live = useLiveQuery(query, deps)
  if (live !== undefined) {
    cache.set(key, live)
    return live
  }
  return cache.get(key) as T | undefined
}
