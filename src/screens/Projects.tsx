import { useCachedLiveQuery } from '../lib/useCached'
import { Link, useSearchParams } from 'react-router-dom'
import { db, type Counter, type Project, type ProjectStatus } from '../db'
import { STATUS_LABEL, progressOf } from '../lib/projects'
import { EmptyState, PageHeader, ProgressBar } from '../components/ui'
import { GridIcon, PlusIcon, YarnBallArt, YarnIcon } from '../components/Icons'
import { FileImage } from '../components/FileImage'
import { InstallBanner } from './Tabs'
import { BackupReminder } from './Backup'

const FILTERS: ProjectStatus[] = ['in_progress', 'planned', 'finished']

const EMPTY_FILTER_TEXT: Record<ProjectStatus, string> = {
  in_progress: 'Nothing on the needles right now. Start a planned project, or tap + for a new one.',
  planned: 'No plans yet. Tap + to jot down your next idea.',
  finished: 'Finished pieces will show up here (and in Made with Love).',
}

/** The photo to show on a card: chosen cover, else the newest progress photo. */
export function useCoverId(p: Project) {
  return useCachedLiveQuery(`cover:${p.id}`, async () => {
    if (p.coverFileId) return p.coverFileId
    const photos = await db.files.where('[ownerType+ownerId]').equals(['project', p.id]).toArray()
    photos.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    return photos[0]?.id ?? null
  }, [p.id, p.coverFileId, p.updatedAt])
}

export function StatusPill({ status }: { status: ProjectStatus }) {
  const cls = {
    planned: 'bg-heather-soft text-heather',
    in_progress: 'bg-rose-soft text-rose-dark',
    finished: 'bg-[#e5ede2] text-sage',
  }[status]
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-bold ${cls}`}>{STATUS_LABEL[status]}</span>
  )
}

function ProjectCard({ p, mainCounter }: { p: Project; mainCounter?: Counter }) {
  const coverId = useCoverId(p)
  const progress = progressOf(p, mainCounter)
  return (
    <Link
      to={`/projects/${p.id}`}
      className="flex gap-4 rounded-3xl border border-line bg-paper p-3 shadow-[0_1px_0_rgba(0,0,0,0.03)] active:bg-oat"
    >
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-rose-soft">
        {coverId ? (
          <FileImage fileId={coverId} className="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <YarnBallArt size={64} />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-1 pr-1">
        <h2 className="line-clamp-2 text-xl leading-tight font-semibold break-words">{p.name || 'Untitled project'}</h2>
        <p className="truncate text-ink-soft">
          {[p.type, p.madeFor && `for ${p.madeFor}`].filter(Boolean).join(' · ') || p.craft}
        </p>
        <div className="flex items-center gap-2">
          <StatusPill status={p.status} />
          {progress !== null && <span className="text-sm text-ink-soft">{Math.round(progress * 100)}%</span>}
        </div>
        {progress !== null && <ProgressBar value={progress} className="mt-1" />}
      </div>
    </Link>
  )
}

export function ProjectsScreen() {
  const [params, setParams] = useSearchParams()
  const filter = (FILTERS.includes(params.get('f') as ProjectStatus) ? params.get('f') : 'in_progress') as ProjectStatus

  const data = useCachedLiveQuery('projects-list', async () => {
    const [projects, counters] = await Promise.all([db.projects.toArray(), db.counters.toArray()])
    const main = new Map<string, Counter>()
    for (const c of counters) {
      const cur = main.get(c.projectId)
      if (!cur || c.order < cur.order) main.set(c.projectId, c)
    }
    return { projects, main }
  }, [])

  const all = data?.projects ?? []
  const counts = Object.fromEntries(FILTERS.map((f) => [f, all.filter((p) => p.status === f).length])) as Record<
    ProjectStatus,
    number
  >
  const shown = all
    .filter((p) => p.status === filter)
    .sort((a, b) =>
      filter === 'finished'
        ? (b.finishDate ?? '').localeCompare(a.finishDate ?? '') || b.updatedAt - a.updatedAt
        : b.updatedAt - a.updatedAt,
    )

  return (
    <>
      <PageHeader
        title="Projects"
        action={
          <Link
            to="/designs"
            className="mb-1 flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper px-4 font-semibold text-ink active:bg-oat"
          >
            <GridIcon size={20} />
            Designs
          </Link>
        }
      />
      <InstallBanner />
      <BackupReminder />

      {!data ? null : all.length === 0 ? (
        <EmptyState art={<YarnIcon size={56} strokeWidth={1.4} />} title="No projects yet">
          Tap <b className="text-rose">+</b> to start your first one. Your patterns, yarn and row counts will all live
          here.
          <Link
            to="/settings/backup"
            className="mt-6 flex min-h-12 items-center justify-center text-base font-semibold text-heather underline"
          >
            Moving from another phone? Restore a backup
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4 pb-1" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setParams(f === 'in_progress' ? {} : { f }, { replace: true })}
                className={`min-h-12 flex-1 shrink-0 rounded-full border px-3 text-[15px] font-semibold whitespace-nowrap transition-colors ${
                  filter === f ? 'border-rose bg-rose text-white' : 'border-line bg-paper text-ink active:bg-oat'
                }`}
              >
                {STATUS_LABEL[f]}
                <span className={`ml-1.5 ${filter === f ? 'text-white/80' : 'text-ink-soft'}`}>{counts[f]}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3 px-5 pt-3 pb-28">
            {shown.map((p) => (
              <ProjectCard key={p.id} p={p} mainCounter={data?.main.get(p.id)} />
            ))}
            {data && shown.length === 0 && (
              <p className="px-4 pt-10 text-center text-lg leading-relaxed text-ink-soft">{EMPTY_FILTER_TEXT[filter]}</p>
            )}
          </div>
        </>
      )}

      <Link
        to={`/projects/new${filter !== 'in_progress' ? `?status=${filter}` : ''}`}
        aria-label="New project"
        className="fixed right-5 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-rose text-white shadow-lg active:bg-rose-dark"
        style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
      >
        <PlusIcon size={32} strokeWidth={2.2} />
      </Link>
    </>
  )
}
