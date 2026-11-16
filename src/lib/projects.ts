import { db, newId, type Counter, type Project, type ProjectStatus, type StoredFile } from '../db'
import { compressImage } from './images'
import { syncReservations } from './stash'

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  finished: 'Finished',
}

/** Today's date in local time as YYYY-MM-DD. */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Dec 25, 2026" from YYYY-MM-DD (parsed as a local date, not UTC). */
export function formatDate(iso?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function blankProject(): Project {
  const now = Date.now()
  return {
    id: newId(),
    name: '',
    type: '',
    craft: 'Knitting',
    status: 'in_progress',
    pattern: { name: '', source: '', detail: '' },
    materials: { stashIds: [], yarnText: '', needleSize: '', meshCount: '', gauge: '' },
    madeFor: '',
    notes: '',
    progressMode: 'none',
    progressPercent: 0,
    rowsDone: 0,
    rowsTotal: 0,
    createdAt: now,
    updatedAt: now,
  }
}

export function blankCounter(projectId: string, name: string, order: number): Counter {
  return { id: newId(), projectId, name, count: 0, order, reminders: [], updatedAt: Date.now() }
}

/** Fill in a blank start/finish date to match the project's status. */
function withStatusDates(p: Project): Project {
  const out = { ...p }
  if (out.status !== 'planned' && !out.startDate) out.startDate = today()
  if (out.status === 'finished' && !out.finishDate) out.finishDate = today()
  return out
}

/** New projects always get one counter so the Row Counter is ready to go. */
export async function createProject(p: Project) {
  await db.transaction('rw', db.projects, db.counters, db.stash, async () => {
    await db.projects.add({ ...withStatusDates(p), createdAt: Date.now(), updatedAt: Date.now() })
    await db.counters.add(blankCounter(p.id, 'Rows', 0))
    await syncReservations(p.id, [], p.materials.stashIds)
  })
}

export async function saveProject(p: Project) {
  await db.transaction('rw', db.projects, db.stash, async () => {
    const before = (await db.projects.get(p.id))?.materials.stashIds ?? []
    await db.projects.put({ ...withStatusDates(p), updatedAt: Date.now() })
    await syncReservations(p.id, before, p.materials.stashIds)
  })
}

export async function patchProject(id: string, changes: Partial<Project>) {
  await db.projects.update(id, { ...changes, updatedAt: Date.now() })
}

/** Move a project to a new status, filling in start/finish dates if blank. */
export async function setStatus(p: Project, status: ProjectStatus) {
  const changes: Partial<Project> = { status }
  if (status === 'in_progress' && !p.startDate) changes.startDate = today()
  if (status === 'finished' && !p.finishDate) changes.finishDate = today()
  await patchProject(p.id, changes)
}

export async function deleteProject(id: string) {
  await db.transaction('rw', [db.projects, db.files, db.counters, db.stash, db.designs], async () => {
    await db.projects.delete(id)
    await db.files.where('ownerId').equals(id).delete()
    await db.counters.where('projectId').equals(id).delete()
    await db.stash.where('reservedForProjectId').equals(id).modify((s) => {
      delete s.reservedForProjectId
    })
    await db.designs.where('projectId').equals(id).modify((d) => {
      delete d.projectId
    })
  })
}

/** Compress and store progress photos. Returns the new file ids. */
export async function addProjectPhotos(projectId: string, files: File[], date = today()): Promise<string[]> {
  const ids: string[] = []
  for (const f of files) {
    const img = await compressImage(f)
    const rec: StoredFile = {
      id: newId(),
      ownerType: 'project',
      ownerId: projectId,
      kind: 'photo',
      blob: img.blob,
      thumb: img.thumb,
      mime: 'image/jpeg',
      width: img.width,
      height: img.height,
      date,
      createdAt: Date.now(),
    }
    await db.files.add(rec)
    ids.push(rec.id)
  }
  await patchProject(projectId, {})
  return ids
}

/** Store a pattern photo (compressed) or PDF (as-is), replacing any previous one. */
export async function setPatternFile(project: Project, file: File): Promise<string> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const rec: StoredFile = {
    id: newId(),
    ownerType: 'pattern',
    ownerId: project.id,
    kind: isPdf ? 'pdf' : 'photo',
    blob: file,
    mime: isPdf ? 'application/pdf' : 'image/jpeg',
    name: file.name,
    date: today(),
    createdAt: Date.now(),
  }
  if (!isPdf) {
    // Patterns need to stay legible, so allow a bit more resolution.
    const img = await compressImage(file, 2400, 0.85)
    Object.assign(rec, { blob: img.blob, thumb: img.thumb, width: img.width, height: img.height })
  }
  await db.transaction('rw', db.files, db.projects, async () => {
    if (project.pattern.fileId) await db.files.delete(project.pattern.fileId)
    await db.files.add(rec)
    await db.projects.update(project.id, { pattern: { ...project.pattern, fileId: rec.id }, updatedAt: Date.now() })
  })
  return rec.id
}

export async function removePatternFile(project: Project) {
  if (!project.pattern.fileId) return
  const { fileId, ...rest } = project.pattern
  await db.transaction('rw', db.files, db.projects, async () => {
    await db.files.delete(fileId)
    await db.projects.update(project.id, { pattern: rest, updatedAt: Date.now() })
  })
}

export async function deletePhoto(project: Project, fileId: string) {
  await db.transaction('rw', db.files, db.projects, async () => {
    await db.files.delete(fileId)
    if (project.coverFileId === fileId) await db.projects.update(project.id, { coverFileId: undefined })
  })
}

/**
 * Progress from 0–1, or null when not tracked.
 * In "rows" mode, rows done come from the project's main (first) counter.
 */
export function progressOf(p: Project, mainCounter?: Counter): number | null {
  if (p.status === 'finished') return 1
  if (p.progressMode === 'percent') return p.progressPercent / 100
  if (p.progressMode === 'rows' && p.rowsTotal > 0) {
    const done = mainCounter?.count ?? p.rowsDone
    return Math.min(1, done / p.rowsTotal)
  }
  return null
}
