import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  BackupError,
  backupDue,
  createBackup,
  deliverBackup,
  formatBytes,
  markBackedUp,
  readBackup,
  restoreBackup,
  timeAgo,
  type BackupFile,
  type BackupSummary,
} from '../lib/backup'
import { formatDate } from '../lib/projects'
import { setSetting, useSettings } from '../lib/settings'
import { isStandalone } from '../lib/platform'
import { Button, Card, PageHeader, SectionLabel, Sheet } from '../components/ui'
import { XIcon } from '../components/Icons'

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

function describe(s: BackupSummary) {
  return [
    plural(s.projects, 'project'),
    plural(s.photos, 'photo'),
    plural(s.stash, 'stash item'),
    s.designs ? plural(s.designs, 'design') : '',
  ]
    .filter(Boolean)
    .join(', ')
}

const dateOf = (t: number) => {
  const d = new Date(t)
  return formatDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
}

/** Whether there's anything on the phone worth backing up. */
function useHasData() {
  return useLiveQuery(async () => (await db.projects.count()) + (await db.stash.count()) > 0, [])
}

/** Gentle "time to back up" card for the Projects screen. */
export function BackupReminder() {
  const s = useSettings()
  const hasData = useHasData()
  if (!backupDue(s, !!hasData)) return null
  return (
    <div className="mx-5 mt-4 rounded-2xl border border-heather/30 bg-heather-soft p-4">
      <div className="flex items-start gap-2">
        <p className="flex-1 text-lg leading-snug text-ink">
          {s.lastBackupAt
            ? `Your last backup was ${timeAgo(s.lastBackupAt)}.`
            : 'You haven’t made a backup yet.'}{' '}
          Save a copy of your projects and photos somewhere safe?
        </p>
        <button
          aria-label="Remind me later"
          onClick={() => setSetting('backupReminderSnoozedAt', Date.now())}
          className="-mt-2 -mr-2 flex h-12 w-12 shrink-0 items-center justify-center text-ink-soft"
        >
          <XIcon size={22} />
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <Link
          to="/settings/backup"
          className="flex min-h-12 items-center rounded-full bg-heather px-5 font-semibold text-white active:opacity-90"
        >
          Back up now
        </Link>
        <button
          onClick={() => setSetting('backupReminderSnoozedAt', Date.now())}
          className="min-h-12 rounded-full px-4 font-semibold text-heather active:bg-white/50"
        >
          Later
        </button>
      </div>
    </div>
  )
}

type ExportState =
  | { step: 'idle' }
  | { step: 'preparing' }
  | { step: 'ready'; file: File; summary: BackupSummary }
  | { step: 'done' }
  | { step: 'error'; message: string }

export function BackupScreen() {
  const s = useSettings()
  const hasData = useHasData()
  const [exp, setExp] = useState<ExportState>({ step: 'idle' })
  const [pending, setPending] = useState<{ backup: BackupFile; summary: BackupSummary } | null>(null)
  const [restoreMsg, setRestoreMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [usage, setUsage] = useState<string | null>(null)

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage != null && setUsage(formatBytes(e.usage)))
      .catch(() => {})
  }, [exp.step])

  const prepare = async () => {
    setExp({ step: 'preparing' })
    try {
      const { file, summary } = await createBackup()
      setExp({ step: 'ready', file, summary })
    } catch (e) {
      setExp({ step: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' })
    }
  }

  // Called straight from the tap so the Share sheet is allowed to open.
  const save = async (file: File, summary: BackupSummary) => {
    const ok = await deliverBackup(file)
    if (ok) {
      await markBackedUp(summary.exportedAt)
      setExp({ step: 'done' })
    }
  }

  const pick = async (file: File | undefined) => {
    setRestoreMsg(null)
    if (!file) return
    try {
      setPending(await readBackup(file))
    } catch (e) {
      setRestoreMsg({
        ok: false,
        text: e instanceof BackupError ? e.message : 'That file couldn’t be opened.',
      })
    }
  }

  const restore = async () => {
    if (!pending) return
    setRestoring(true)
    try {
      await restoreBackup(pending.backup)
      setRestoreMsg({ ok: true, text: `Restored your backup from ${dateOf(pending.summary.exportedAt)}. Welcome back!` })
    } catch {
      setRestoreMsg({
        ok: false,
        text: 'Restoring didn’t work, and nothing on this phone was changed. Your phone may be low on space.',
      })
    }
    setRestoring(false)
    setPending(null)
  }

  return (
    <>
      <PageHeader title="Backup" subtitle="Keep your work safe" back="/settings" />
      <div className="px-5 pb-10">
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">
          Everything in Kann Knits lives only on this phone. A backup is one file with all your projects, row counts,
          photos and stash. Save it somewhere safe, like <b className="text-ink">Files → iCloud Drive</b>, or email it to
          yourself.
        </p>

        <SectionLabel>Back up</SectionLabel>
        <Card>
          <div className="space-y-3 p-4">
            <p className="text-lg">
              {s.lastBackupAt ? (
                <>
                  Last backup: <b>{dateOf(s.lastBackupAt)}</b> <span className="text-ink-soft">({timeAgo(s.lastBackupAt)})</span>
                </>
              ) : (
                'No backups yet.'
              )}
            </p>

            {exp.step === 'ready' ? (
              <>
                <p className="text-ink-soft">
                  Ready: {describe(exp.summary)} ({formatBytes(exp.file.size)}).
                </p>
                <Button className="w-full" onClick={() => save(exp.file, exp.summary)}>
                  Save backup file
                </Button>
                <p className="text-sm text-ink-soft">
                  On iPhone, choose <b>Save to Files</b> (or Mail to send it to yourself).
                </p>
              </>
            ) : exp.step === 'done' ? (
              <p className="rounded-2xl bg-[#e5ede2] p-3 text-lg font-semibold text-sage">Backed up ✓ Nice work!</p>
            ) : (
              <Button className="w-full" onClick={prepare} disabled={exp.step === 'preparing' || hasData === false}>
                {exp.step === 'preparing' ? 'Getting everything together…' : 'Back up now'}
              </Button>
            )}
            {hasData === false && exp.step === 'idle' && (
              <p className="text-sm text-ink-soft">Nothing to back up yet. Add a project or some yarn first.</p>
            )}
            {exp.step === 'error' && <p className="text-rose-dark">Backup didn’t work: {exp.message}</p>}
          </div>
        </Card>

        <SectionLabel>Restore</SectionLabel>
        <Card>
          <div className="space-y-3 p-4">
            <p className="text-lg leading-relaxed text-ink-soft">
              Moving to a new phone, or something went missing? Pick a backup file. Everything in it is added back, and
              nothing already here is removed.
            </p>
            <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border border-line bg-paper px-6 text-lg font-semibold active:bg-oat">
              Restore from a backup file
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(e) => {
                  pick(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            {restoreMsg && (
              <p
                className={`rounded-2xl p-3 text-lg ${restoreMsg.ok ? 'bg-[#e5ede2] text-sage' : 'bg-rose-soft text-rose-dark'}`}
              >
                {restoreMsg.text}
              </p>
            )}
          </div>
        </Card>

        <p className="mt-5 px-1 text-sm leading-relaxed text-ink-soft">
          {usage && <>Kann Knits is using about {usage} on this phone. </>}
          {!isStandalone() &&
            'Tip: the Home Screen app and Safari keep separate copies, so back up from the one you actually use.'}
        </p>
      </div>

      <Sheet open={!!pending} title="Restore this backup?" onClose={() => setPending(null)}>
        {pending && (
          <>
            <p className="text-lg leading-relaxed">
              Backup from <b>{dateOf(pending.summary.exportedAt)}</b>: {describe(pending.summary)}.
            </p>
            <p className="mt-2 text-lg leading-relaxed text-ink-soft">
              These will be added to this phone. Nothing here is removed. If something is on both, the newer version is
              kept.
            </p>
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={restore} disabled={restoring}>
                {restoring ? 'Restoring…' : 'Restore'}
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </>
  )
}
