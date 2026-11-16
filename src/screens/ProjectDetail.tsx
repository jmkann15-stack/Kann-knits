import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCachedLiveQuery } from '../lib/useCached'
import { db, type Project, type StoredFile } from '../db'
import {
  addProjectPhotos,
  deletePhoto,
  deleteProject,
  formatDate,
  patchProject,
  progressOf,
  setStatus,
  today,
} from '../lib/projects'
import { useObjectUrl } from '../lib/device'
import { Button, InfoCard, InfoRow as Row, PageHeader, ProgressBar, Sheet, inputClass } from '../components/ui'
import { FileImage } from '../components/FileImage'
import { CounterIcon, GridIcon, PlusIcon, YarnBallArt } from '../components/Icons'
import { DesignThumb } from './Designs'
import { StatusPill } from './Projects'

function PatternFile({ file }: { file: StoredFile }) {
  const url = useObjectUrl(file.blob)
  const [open, setOpen] = useState(false)
  if (!url) return null
  if (file.kind === 'pdf') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-12 items-center font-semibold text-rose underline">
        Open pattern PDF
      </a>
    )
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-2 block overflow-hidden rounded-2xl border border-line">
        <FileImage fileId={file.id} className="h-40 w-full" />
      </button>
      <Sheet open={open} title="Pattern" onClose={() => setOpen(false)}>
        {/* Pinch-zoom works on the full image in a new tab, too. */}
        <img src={url} alt="Pattern" className="w-full rounded-2xl" />
        <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-12 items-center font-semibold text-rose">
          Open full size
        </a>
      </Sheet>
    </>
  )
}

function PhotoViewer({ project, file, onClose }: { project: Project; file: StoredFile; onClose: () => void }) {
  const isCover = project.coverFileId === file.id
  return (
    <Sheet open title={formatDate(file.date)} onClose={onClose}>
      <FileImage fileId={file.id} full className="w-full rounded-2xl" />
      <label className="mt-4 block">
        <span className="mb-1.5 block px-1 font-semibold">Date</span>
        <input
          type="date"
          className={inputClass}
          value={file.date}
          onChange={(e) => e.target.value && db.files.update(file.id, { date: e.target.value })}
        />
      </label>
      <div className="mt-4 flex gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={isCover}
          onClick={() => patchProject(project.id, { coverFileId: file.id })}
        >
          {isCover ? 'Cover photo ✓' : 'Use as cover'}
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            if (!confirm('Delete this photo? This can’t be undone.')) return
            await deletePhoto(project, file.id)
            onClose()
          }}
        >
          Delete
        </Button>
      </div>
    </Sheet>
  )
}

export function ProjectDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const q = useCachedLiveQuery(`project:${id}`, async () => {
    const p = await db.projects.get(id)
    if (!p) return { p }
    const [counters, photos, patternFile, stash, designs] = await Promise.all([
      db.counters.where('projectId').equals(id).sortBy('order'),
      db.files.where('[ownerType+ownerId]').equals(['project', id]).toArray(),
      p.pattern.fileId ? db.files.get(p.pattern.fileId) : undefined,
      p.materials.stashIds.length ? db.stash.bulkGet(p.materials.stashIds) : [],
      db.designs.where('projectId').equals(id).toArray(),
    ])
    photos.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    return { p, counters, photos, patternFile, stash: stash.filter(Boolean), designs }
  }, [id])

  const [viewing, setViewing] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  if (!q) return null
  if (!q.p) return <Navigate to="/" replace />
  const { p, counters = [], photos = [], patternFile, stash = [], designs = [] } = q
  const main = counters[0]
  const progress = progressOf(p, main)
  const coverId = p.coverFileId ?? photos[0]?.id
  const viewingFile = photos.find((f) => f.id === viewing)

  const onAddPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      await addProjectPhotos(p.id, Array.from(files), today())
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Couldn’t add that photo.')
    } finally {
      setUploading(false)
    }
  }

  const sourceLabel = { '': '', book: 'Book', website: 'Website', own: 'My own design' }[p.pattern.source]
  const detailIsUrl = /^https?:\/\//i.test(p.pattern.detail.trim())

  return (
    <>
      <PageHeader
        title={p.name || 'Untitled project'}
        back="/"
        action={
          <Link
            to={`/projects/${p.id}/edit`}
            className="mb-1 flex min-h-12 items-center rounded-full px-4 text-lg font-semibold text-rose active:bg-rose-soft"
          >
            Edit
          </Link>
        }
      />
      <div className="px-5 pt-4 pb-10">
        {/* Cover */}
        <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-rose-soft">
          {coverId ? (
            <FileImage fileId={coverId} full className="h-full w-full" alt={p.name} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-rose-dark">
              <YarnBallArt size={110} />
              <span className="text-base">Add a progress photo below</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill status={p.status} />
          <span className="text-lg text-ink-soft">
            {[p.type, p.craft, p.madeFor && `for ${p.madeFor}`].filter(Boolean).join(' · ')}
          </span>
        </div>

        {/* Row counter */}
        <Link
          to={`/projects/${p.id}/counter`}
          className="mt-5 flex items-center gap-4 rounded-3xl bg-rose p-5 text-white shadow-md active:bg-rose-dark"
        >
          <CounterIcon size={40} strokeWidth={1.6} />
          <span className="flex-1">
            <span className="block text-xl font-semibold">Row Counter</span>
            <span className="block text-white/85">
              {main ? `${main.name}: row ${main.count}` : 'Tap to start counting'}
              {counters.length > 1 && ` · +${counters.length - 1} more`}
            </span>
          </span>
          <span className="font-serif text-4xl font-semibold">{main?.count ?? 0}</span>
        </Link>

        {/* Progress */}
        {p.progressMode === 'percent' && p.status !== 'finished' && (
          <div className="mt-5 rounded-3xl border border-line bg-paper p-4">
            <div className="mb-1 flex justify-between text-lg">
              <span className="font-semibold">Progress</span>
              <span className="text-ink-soft">{p.progressPercent}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={p.progressPercent}
              onChange={(e) => patchProject(p.id, { progressPercent: Number(e.target.value) })}
              className="h-12 w-full accent-rose"
              aria-label="Progress percent"
            />
          </div>
        )}
        {(p.progressMode === 'rows' || p.status === 'finished') && progress !== null && (
          <div className="mt-5 rounded-3xl border border-line bg-paper p-4">
            <div className="mb-2 flex justify-between text-lg">
              <span className="font-semibold">Progress</span>
              <span className="text-ink-soft">
                {p.status === 'finished'
                  ? 'Finished!'
                  : `${main?.count ?? 0} of ${p.rowsTotal} rows`}
              </span>
            </div>
            <ProgressBar value={progress} />
          </div>
        )}

        {/* Status action */}
        <div className="mt-5">
          {p.status === 'planned' && (
            <Button className="w-full" variant="secondary" onClick={() => setStatus(p, 'in_progress')}>
              Start this project
            </Button>
          )}
          {p.status === 'in_progress' && (
            <Button className="w-full" variant="secondary" onClick={() => setStatus(p, 'finished')}>
              Mark as finished 🎉
            </Button>
          )}
          {p.status === 'finished' && (
            <Button className="w-full" variant="ghost" onClick={() => setStatus(p, 'in_progress')}>
              Move back to In Progress
            </Button>
          )}
        </div>

        {/* Photos */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-xl font-semibold text-rose-dark">Progress photos</h2>
            <label className="inline-flex min-h-12 cursor-pointer items-center gap-1 rounded-full px-3 text-lg font-semibold text-rose active:bg-rose-soft">
              <PlusIcon size={22} /> {uploading ? 'Adding…' : 'Add'}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  onAddPhotos(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {photos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-lg text-ink-soft">
              Snap a photo as you go. It’s lovely to look back on.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((f) => (
                <button key={f.id} onClick={() => setViewing(f.id)} className="relative overflow-hidden rounded-xl">
                  <FileImage fileId={f.id} className="aspect-square w-full" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 pt-4 pb-1 text-left text-xs font-semibold text-white">
                    {formatDate(f.date)}
                  </span>
                  {p.coverFileId === f.id && (
                    <span className="absolute top-1 left-1 rounded-full bg-white/90 px-2 text-xs font-bold text-rose-dark">
                      Cover
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Designs */}
        {designs.length > 0 ? (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-xl font-semibold text-rose-dark">Designs</h2>
              <Link
                to={`/designs/new?project=${p.id}`}
                className="inline-flex min-h-12 items-center gap-1 rounded-full px-3 text-lg font-semibold text-rose active:bg-rose-soft"
              >
                <PlusIcon size={22} /> New
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {designs.map((d) => (
                <Link key={d.id} to={`/designs/${d.id}`} className="overflow-hidden rounded-2xl border border-line bg-paper active:bg-oat">
                  <DesignThumb design={d} className="aspect-[4/3] w-full p-2" />
                  <p className="truncate px-3 py-2 font-semibold">{d.name || 'Untitled design'}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <Link
            to={`/designs/new?project=${p.id}`}
            className="mt-4 flex min-h-12 items-center gap-2 px-1 text-lg font-semibold text-rose"
          >
            <GridIcon size={22} /> Sketch a design on graph paper
          </Link>
        )}

        {/* Details */}
        {(p.pattern.name || sourceLabel || patternFile) && (
          <InfoCard title="Pattern">
            <Row label="Name">{p.pattern.name}</Row>
            <Row label="From">{sourceLabel}</Row>
            <Row label={p.pattern.source === 'website' ? 'Link' : 'Details'}>
              {detailIsUrl ? (
                <a href={p.pattern.detail.trim()} target="_blank" rel="noreferrer" className="text-rose underline">
                  {p.pattern.detail.replace(/^https?:\/\/(www\.)?/i, '')}
                </a>
              ) : (
                p.pattern.detail
              )}
            </Row>
            {patternFile && <PatternFile file={patternFile} />}
          </InfoCard>
        )}

        {(stash.length > 0 || Object.entries(p.materials).some(([k, v]) => k !== 'stashIds' && v)) && (
          <InfoCard title="Materials">
            <Row label="From stash">
              {stash.length > 0 &&
                stash.map((s, i) => (
                  <span key={s!.id}>
                    {i > 0 && ', '}
                    <Link to={`/stash/${s!.id}`} className="text-rose underline">
                      {s!.name}
                      {s!.colorName && ` (${s!.colorName})`}
                    </Link>
                  </span>
                ))}
            </Row>
            <Row label="Yarn">{p.materials.yarnText}</Row>
            <Row label="Needles">{p.materials.needleSize}</Row>
            <Row label="Mesh">{p.materials.meshCount}</Row>
            <Row label="Gauge">{p.materials.gauge}</Row>
          </InfoCard>
        )}

        {(p.startDate || p.finishDate) && (
          <InfoCard title="Dates">
            <Row label="Started">{formatDate(p.startDate)}</Row>
            <Row label="Finished">{formatDate(p.finishDate)}</Row>
          </InfoCard>
        )}

        {p.notes && (
          <InfoCard title="Notes">
            <p className="text-lg leading-relaxed whitespace-pre-wrap">{p.notes}</p>
          </InfoCard>
        )}

        <Button
          variant="ghost"
          className="mt-10 w-full text-ink-soft"
          onClick={async () => {
            if (
              !confirm(
                `Delete “${p.name || 'this project'}”?\n\nIts photos and row counts will be deleted too. This can’t be undone.`,
              )
            )
              return
            await deleteProject(p.id)
            navigate('/', { replace: true })
          }}
        >
          Delete project
        </Button>
      </div>

      {viewingFile && <PhotoViewer project={p} file={viewingFile} onClose={() => setViewing(null)} />}
    </>
  )
}
