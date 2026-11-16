import { db } from '../db'
import { setSetting } from './settings'

/**
 * Runs once per launch. Records the first launch and asks the browser to
 * mark our storage as persistent so iOS/Android are less likely to evict it.
 */
export async function initStorage() {
  const first = await db.settings.get('firstLaunchAt')
  if (!first) await setSetting('firstLaunchAt', Date.now())

  let persisted: boolean | null = null
  try {
    if (navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted()
      if (!persisted && navigator.storage.persist) {
        persisted = await navigator.storage.persist()
      }
    }
  } catch {
    persisted = null
  }
  await setSetting('storagePersisted', persisted)
}
