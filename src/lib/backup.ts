import { db, type Counter, type Design, type Project, type StashItem, type StoredFile } from '../db'
import { BACKUP_REMINDER_DAYS } from '../config'
import { DEFAULT_SETTINGS, setSetting, type Settings } from './settings'
import { today } from './projects'
import { shareOrDownload } from './share'

// One JSON file holds everything, with photos/PDFs base64-encoded.
// Restoring *merges*: nothing already on the phone is deleted, and when the
// same record exists in both places the more recently changed one wins.

export const BACKUP_APP = 'kann-knits'
export const BACKUP_VERSION = 1

interface EncodedBlob {
  mime: string
  base64: string
}
type EncodedFile = Omit<StoredFile, 'blob' | 'thumb'> & { blob: EncodedBlob; thumb?: EncodedBlob }

interface BackupData {
  projects: Project[]
  files: EncodedFile[]
  counters: Counter[]
  stash: StashItem[]
  designs: Design[]
  settings: Partial<Settings>
}

export interface BackupFile {
  app: typeof BACKUP_APP
  version: number
  exportedAt: number
  data: BackupData
}

export interface BackupSummary {
  exportedAt: number
  projects: number
  photos: number
  stash: number
  designs: number
}

// Settings that describe this phone rather than her data, so they're not copied.
const DEVICE_ONLY: (keyof Settings)[] = ['storagePersisted', 'installBannerDismissed', 'backupReminderSnoozedAt']

// ── Encoding ──────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = r.result as string
      resolve(s.slice(s.indexOf(',') + 1))
    }
    r.onerror = () => reject(r.error ?? new Error('Could not read a photo.'))
    r.readAsDataURL(blob)
  })
}

function base64ToBlob({ mime, base64 }: EncodedBlob): Blob {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function encodeBlob(b: Blob, fallbackMime: string): Promise<EncodedBlob> {
  return { mime: b.type || fallbackMime, base64: await blobToBase64(b) }
}

// ── Export ────────────────────────────────────────────────────

/**
 * Build the backup file. Records are read in one transaction so the snapshot
 * is consistent. The JSON is assembled in pieces so one huge string isn't needed.
 */
export async function createBackup(): Promise<{ file: File; summary: BackupSummary }> {
  const [projects, files, counters, stash, designs, settingRows] = await db.transaction(
    'r',
    [db.projects, db.files, db.counters, db.stash, db.designs, db.settings],
    () =>
      Promise.all([
        db.projects.toArray(),
        db.files.toArray(),
        db.counters.toArray(),
        db.stash.toArray(),
        db.designs.toArray(),
        db.settings.toArray(),
      ]),
  )

  const settings: Partial<Settings> = {}
  for (const r of settingRows) {
    const k = r.key as keyof Settings
    if (k in DEFAULT_SETTINGS && !DEVICE_ONLY.includes(k)) (settings as Record<string, unknown>)[k] = r.value
  }

  const exportedAt = Date.now()
  const parts: (string | Blob)[] = []
  const head = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt }
  parts.push(JSON.stringify(head).slice(0, -1), ',"data":{')
  parts.push(`"projects":${JSON.stringify(projects)},`)
  parts.push(`"counters":${JSON.stringify(counters)},`)
  parts.push(`"stash":${JSON.stringify(stash)},`)
  parts.push(`"designs":${JSON.stringify(designs)},`)
  parts.push(`"settings":${JSON.stringify(settings)},`)
  parts.push('"files":[')
  for (let i = 0; i < files.length; i++) {
    const { blob, thumb, ...rest } = files[i]
    const enc: EncodedFile = { ...rest, blob: await encodeBlob(blob, rest.mime) }
    if (thumb) enc.thumb = await encodeBlob(thumb, 'image/jpeg')
    parts.push((i ? ',' : '') + JSON.stringify(enc))
  }
  parts.push(']}}')

  const file = new File(parts, `kann-knits-backup-${today()}.json`, { type: 'application/json' })
  return {
    file,
    summary: {
      exportedAt,
      projects: projects.length,
      photos: files.length,
      stash: stash.length,
      designs: designs.length,
    },
  }
}

/** Save the backup via the Share sheet or a download. */
export function deliverBackup(file: File): Promise<boolean> {
  return shareOrDownload(file, 'Kann Knits backup')
}

export async function markBackedUp(at = Date.now()) {
  await setSetting('lastBackupAt', at)
  await setSetting('backupReminderSnoozedAt', null)
}

// ── Restore ───────────────────────────────────────────────────

export class BackupError extends Error {}

/** Read and check a backup file. Throws BackupError with a friendly message. */
export async function readBackup(file: File): Promise<{ backup: BackupFile; summary: BackupSummary }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new BackupError('That file isn’t a Kann Knits backup. Look for a file named “kann-knits-backup-…”.')
  }
  const b = parsed as Partial<BackupFile>
  if (!b || b.app !== BACKUP_APP || typeof b.version !== 'number' || !b.data) {
    throw new BackupError('That file isn’t a Kann Knits backup. Look for a file named “kann-knits-backup-…”.')
  }
  if (b.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of Kann Knits. Update the app and try again.')
  }
  const d = b.data
  for (const k of ['projects', 'files', 'counters', 'stash', 'designs'] as const) {
    if (!Array.isArray(d[k])) d[k] = [] as never
  }
  if (!d.settings || typeof d.settings !== 'object') d.settings = {}
  return {
    backup: b as BackupFile,
    summary: {
      exportedAt: b.exportedAt ?? 0,
      projects: d.projects.length,
      photos: d.files.length,
      stash: d.stash.length,
      designs: d.designs.length,
    },
  }
}

/** Keep `a`'s order, then add anything only in `b`. */
function union(a: string[], b: string[]) {
  const out = [...a]
  for (const x of b) if (!out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x)
  return out
}

/** Merge a backup into this phone, all-or-nothing. Returns how many records changed. */
export async function restoreBackup(backup: BackupFile): Promise<number> {
  const d = backup.data
  // Decode photos first, outside the transaction.
  const files: StoredFile[] = d.files.map((f) => ({
    ...f,
    blob: base64ToBlob(f.blob),
    thumb: f.thumb ? base64ToBlob(f.thumb) : undefined,
  }))
  for (const f of files) if (!f.thumb) delete f.thumb

  let changed = 0
  await db.transaction(
    'rw',
    [db.projects, db.files, db.counters, db.stash, db.designs, db.settings],
    async () => {
      // Newer wins for records that change over time.
      const mergeNewer = async <T extends { id: string; updatedAt: number }>(
        table: typeof db.projects | typeof db.counters | typeof db.stash | typeof db.designs,
        rows: T[],
      ) => {
        if (!rows.length) return
        const t = table as unknown as import('dexie').Table<T, string>
        const existing = await t.bulkGet(rows.map((r) => r.id))
        const toPut = rows.filter((r, i) => !existing[i] || (existing[i]!.updatedAt ?? 0) < (r.updatedAt ?? 0))
        if (toPut.length) await t.bulkPut(toPut)
        changed += toPut.length
      }
      await mergeNewer(db.projects, d.projects)
      await mergeNewer(db.counters, d.counters)
      await mergeNewer(db.stash, d.stash)
      await mergeNewer(db.designs, d.designs)

      // Photos never change after saving (except the date), so add any that are missing.
      const have = await db.files.bulkGet(files.map((f) => f.id))
      const newFiles = files.filter((_, i) => !have[i])
      if (newFiles.length) await db.files.bulkAdd(newFiles)
      changed += newFiles.length

      // Settings: combine lists, keep this phone's preferences.
      const cur = Object.fromEntries((await db.settings.toArray()).map((r) => [r.key, r.value])) as Partial<Settings>
      const s = d.settings
      const put = (key: keyof Settings, value: unknown) => db.settings.put({ key, value })
      if (Array.isArray(s.family)) await put('family', union(s.family, cur.family ?? DEFAULT_SETTINGS.family))
      if (Array.isArray(s.projectTypes))
        await put('projectTypes', union(cur.projectTypes ?? s.projectTypes, s.projectTypes))
      if (typeof s.lastBackupAt === 'number' && s.lastBackupAt > (cur.lastBackupAt ?? 0))
        await put('lastBackupAt', s.lastBackupAt)
      if (typeof s.firstLaunchAt === 'number' && s.firstLaunchAt < (cur.firstLaunchAt ?? Infinity))
        await put('firstLaunchAt', s.firstLaunchAt)
      if (s.largerText === true) await put('largerText', true)
      await put('onboarded', true)
    },
  )
  // Restoring counts as being backed up as of when that file was made.
  const cur = await db.settings.get('lastBackupAt')
  if (backup.exportedAt > ((cur?.value as number | null) ?? 0)) await setSetting('lastBackupAt', backup.exportedAt)
  return changed
}

// ── Reminder ──────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000
export const SNOOZE_DAYS = 14

/** Is it time to gently suggest a backup? Only once she has something worth saving. */
export function backupDue(s: Settings, hasData: boolean, now = Date.now()): boolean {
  if (!hasData) return false
  const since = s.lastBackupAt ?? s.firstLaunchAt
  if (!since) return false
  if (now - since < BACKUP_REMINDER_DAYS * DAY) return false
  if (s.backupReminderSnoozedAt && now - s.backupReminderSnoozedAt < SNOOZE_DAYS * DAY) return false
  return true
}

/** "today", "yesterday", "12 days ago", "3 months ago". */
export function timeAgo(t: number, now = Date.now()): string {
  const days = Math.floor((now - t) / DAY)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 45) return `${days} days ago`
  const months = Math.round(days / 30)
  if (months < 18) return `${months} months ago`
  return `${Math.round(days / 365)} years ago`
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
