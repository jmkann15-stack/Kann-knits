import { createContext, useContext, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { DEFAULT_FAMILY, DEFAULT_PROJECT_TYPES } from '../config'

/** All app settings, stored as key/value rows in the `settings` table. */
export interface Settings {
  onboarded: boolean
  family: string[]
  projectTypes: string[]
  largerText: boolean
  firstLaunchAt: number | null
  lastBackupAt: number | null
  backupReminderSnoozedAt: number | null
  storagePersisted: boolean | null
  installBannerDismissed: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  family: DEFAULT_FAMILY,
  projectTypes: DEFAULT_PROJECT_TYPES,
  largerText: false,
  firstLaunchAt: null,
  lastBackupAt: null,
  backupReminderSnoozedAt: null,
  storagePersisted: null,
  installBannerDismissed: false,
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.settings.put({ key, value })
}

const Ctx = createContext<Settings>(DEFAULT_SETTINGS)

/** Renders `fallback` until settings have loaded from IndexedDB (avoids flashes). */
export function SettingsProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const settings = useLiveQuery(async () => {
    const rows = await db.settings.toArray()
    const out: Settings = { ...DEFAULT_SETTINGS }
    for (const r of rows) {
      if (r.key in out) (out as unknown as Record<string, unknown>)[r.key] = r.value
    }
    return out
  }, [])
  if (!settings) return <>{fallback}</>
  return <Ctx.Provider value={settings}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
