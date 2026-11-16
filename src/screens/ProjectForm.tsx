import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Craft, type PatternSource, type Project, type ProgressMode, type ProjectStatus } from '../db'
import { CRAFTS, JUST_FOR_ME } from '../config'
import { useSettings } from '../lib/settings'
import {
  STATUS_LABEL,
  blankProject,
  createProject,
  removePatternFile,
  saveProject,
  setPatternFile,
} from '../lib/projects'
import { Choice, DateInput, Field, PageHeader, SaveBar, inputClass, useGoBack } from '../components/ui'
import { FileImage } from '../components/FileImage'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 px-1 text-xl font-semibold text-rose-dark">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

const SOURCE_OPTIONS: { value: PatternSource; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'book', label: 'Book' },
  { value: 'website', label: 'Website' },
  { value: 'own', label: 'My own design' },
]

const PROGRESS_OPTIONS: { value: ProgressMode; label: string }[] = [
  { value: 'none', label: 'Don’t track' },
  { value: 'percent', label: 'Percent' },
  { value: 'rows', label: 'Rows' },
]

export function ProjectFormScreen() {
  const { id } = useParams()
  const isNew = !id
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const goBack = useGoBack(id ? `/projects/${id}` : '/')
  const { family, projectTypes } = useSettings()

  // Wrapped so "still loading" (undefined) differs from "not found" ({ p: undefined }).
  const existingQ = useLiveQuery(async () => ({ p: id ? await db.projects.get(id) : undefined }), [id])
  const existing = existingQ?.p
  const stashQ = useLiveQuery(async () => {
    const [items, projects] = await Promise.all([db.stash.toArray(), db.projects.toArray()])
    const names = new Map(projects.map((p) => [p.id, p.name]))
    items.sort((a, b) => a.name.localeCompare(b.name) || a.colorName.localeCompare(b.colorName))
    return { items, names }
  }, [])
  const stash = stashQ?.items

  const [form, setForm] = useState<Project | null>(() => {
    if (!isNew) return null
    const p = blankProject()
    const s = search.get('status') as ProjectStatus | null
    if (s && s in STATUS_LABEL) p.status = s
    return p
  })
  // Load the existing project once.
  const loaded = useRef(false)
  useEffect(() => {
    if (!isNew && existing && !loaded.current) {
      loaded.current = true
      setForm(structuredClone(existing))
    }
  }, [existing, isNew])

  const [patternFile, setPatternFileState] = useState<File | null>(null)
  const [removePattern, setRemovePattern] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isNew && !existingQ) return null
  if (!isNew && !existing) return <Navigate to="/" replace />
  if (!form) return null

  const set = <K extends keyof Project>(k: K, v: Project[K]) => setForm({ ...form, [k]: v })
  const setPattern = (v: Partial<Project['pattern']>) => setForm({ ...form, pattern: { ...form.pattern, ...v } })
  const setMat = (v: Partial<Project['materials']>) => setForm({ ...form, materials: { ...form.materials, ...v } })

  const typeOptions = form.type && !projectTypes.includes(form.type) ? [...projectTypes, form.type] : projectTypes
  const forOptions = [...family, JUST_FOR_ME]
  if (form.madeFor && !forOptions.includes(form.madeFor)) forOptions.push(form.madeFor)

  const showNeedle = form.craft !== 'Needlepoint'
  const showMesh = form.craft !== 'Knitting'

  const save = async () => {
    if (!form.name.trim()) {
      setError('Give your project a name first.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true)
    try {
      const p: Project = { ...form, name: form.name.trim() }
      if (isNew) await createProject(p)
      else await saveProject(p)
      if (removePattern && !patternFile) await removePatternFile(p)
      if (patternFile) await setPatternFile(p, patternFile)
      if (isNew) navigate(`/projects/${p.id}`, { replace: true })
      else goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving.')
      setSaving(false)
    }
  }

  const hasPattern = !!patternFile || (!!form.pattern.fileId && !removePattern)

  return (
    <>
      <PageHeader title={isNew ? 'New project' : 'Edit project'} back={id ? `/projects/${id}` : '/'} />
      <form
        className="px-5 pt-5 pb-32"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {error && <p className="mb-4 rounded-2xl bg-rose-soft p-4 text-lg text-rose-dark">{error}</p>}

        <div className="space-y-4">
          <Field label="Name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => {
                set('name', e.target.value)
                setError('')
              }}
              placeholder="e.g. Cabled sweater for Dad"
              autoCapitalize="sentences"
            />
          </Field>
          <Field label="Craft">
            <Choice<Craft>
              options={CRAFTS.map((c) => ({ value: c, label: c }))}
              value={form.craft}
              onChange={(v) => set('craft', v)}
            />
          </Field>
          <Field label="Type">
            <select className={inputClass} value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="">Choose…</option>
              {typeOptions.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <Choice<ProjectStatus>
              options={(['planned', 'in_progress', 'finished'] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              value={form.status}
              onChange={(v) => set('status', v)}
            />
          </Field>
          <Field label="Made for">
            <select className={inputClass} value={form.madeFor} onChange={(e) => set('madeFor', e.target.value)}>
              <option value="">Not decided</option>
              {forOptions.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
        </div>

        <Section title="Pattern">
          <Field label="Pattern name">
            <input
              className={inputClass}
              value={form.pattern.name}
              onChange={(e) => setPattern({ name: e.target.value })}
              placeholder="e.g. Aran Classic"
            />
          </Field>
          <Field label="Where it’s from">
            <Choice<PatternSource>
              options={SOURCE_OPTIONS}
              value={form.pattern.source}
              onChange={(v) => setPattern({ source: v })}
            />
          </Field>
          {(form.pattern.source === 'book' || form.pattern.source === 'website') && (
            <Field label={form.pattern.source === 'book' ? 'Book title & page' : 'Website link'}>
              <input
                className={inputClass}
                value={form.pattern.detail}
                onChange={(e) => setPattern({ detail: e.target.value })}
                placeholder={form.pattern.source === 'book' ? 'e.g. Knitting Classics, p. 42' : 'https://…'}
                inputMode={form.pattern.source === 'website' ? 'url' : undefined}
                autoCapitalize={form.pattern.source === 'website' ? 'none' : 'sentences'}
              />
            </Field>
          )}
          <Field label="Pattern photo or PDF" hint="Snap a photo of the page, or attach a PDF.">
            <div className="flex items-center gap-3">
              {hasPattern && (
                <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line bg-paper px-3">
                  {!patternFile && form.pattern.fileId && (
                    <FileImage fileId={form.pattern.fileId} className="h-10 w-10 rounded-lg" />
                  )}
                  <span className="truncate">{patternFile ? patternFile.name : 'Pattern attached'}</span>
                </div>
              )}
              <label className="inline-flex min-h-14 shrink-0 cursor-pointer items-center rounded-2xl border border-line bg-paper px-5 text-lg font-semibold text-rose active:bg-oat">
                {hasPattern ? 'Replace' : 'Add file'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setPatternFileState(f)
                      setRemovePattern(false)
                    }
                    e.target.value = ''
                  }}
                />
              </label>
              {hasPattern && (
                <button
                  type="button"
                  className="min-h-14 shrink-0 px-2 font-semibold text-ink-soft"
                  onClick={() => {
                    setPatternFileState(null)
                    setRemovePattern(true)
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </Field>
        </Section>

        <Section title="Materials">
          <Field label="Yarn from your Stash">
            {stash && stash.length > 0 ? (
              <div className="max-h-64 divide-y divide-line overflow-y-auto rounded-2xl border border-line bg-paper">
                {stash.map((s) => {
                  const on = form.materials.stashIds.includes(s.id)
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() =>
                        setMat({
                          stashIds: on
                            ? form.materials.stashIds.filter((x) => x !== s.id)
                            : [...form.materials.stashIds, s.id],
                        })
                      }
                      className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-oat"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? 'border-rose bg-rose text-white' : 'border-line'}`}
                      >
                        {on && '✓'}
                      </span>
                      <span className="min-w-0 flex-1 py-2 text-lg leading-snug">
                        {s.name}
                        {s.colorName && <span className="text-ink-soft"> · {s.colorName}</span>}
                        {s.reservedForProjectId && s.reservedForProjectId !== form.id && (
                          <span className="block text-sm text-heather">
                            Saved for {stashQ?.names.get(s.reservedForProjectId) ?? 'another project'}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-ink-soft">
                Yarn you add to your Stash can be picked here.
              </p>
            )}
          </Field>
          <Field label="Other yarn or thread">
            <input
              className={inputClass}
              value={form.materials.yarnText}
              onChange={(e) => setMat({ yarnText: e.target.value })}
              placeholder="e.g. 6 skeins Cascade 220, oatmeal"
            />
          </Field>
          {showNeedle && (
            <Field label="Needle size">
              <input
                className={inputClass}
                value={form.materials.needleSize}
                onChange={(e) => setMat({ needleSize: e.target.value })}
                placeholder="e.g. US 7 (4.5 mm)"
              />
            </Field>
          )}
          {showMesh && (
            <Field label="Canvas mesh count">
              <input
                className={inputClass}
                value={form.materials.meshCount}
                onChange={(e) => setMat({ meshCount: e.target.value })}
                placeholder="e.g. 18 mesh"
              />
            </Field>
          )}
          <Field label="Gauge">
            <input
              className={inputClass}
              value={form.materials.gauge}
              onChange={(e) => setMat({ gauge: e.target.value })}
              placeholder="e.g. 20 sts × 28 rows = 4 in"
            />
          </Field>
        </Section>

        <Section title="Dates">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <Field label="Started">
              <DateInput value={form.startDate ?? ''} onChange={(v) => set('startDate', v || undefined)} />
            </Field>
            <Field label="Finished">
              <DateInput value={form.finishDate ?? ''} onChange={(v) => set('finishDate', v || undefined)} />
            </Field>
          </div>
        </Section>

        <Section title="Progress">
          <Choice<ProgressMode>
            options={PROGRESS_OPTIONS}
            value={form.progressMode}
            onChange={(v) => set('progressMode', v)}
          />
          {form.progressMode === 'percent' && (
            <Field label={`About ${form.progressPercent}% done`}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={form.progressPercent}
                onChange={(e) => set('progressPercent', Number(e.target.value))}
                className="h-12 w-full accent-rose"
              />
            </Field>
          )}
          {form.progressMode === 'rows' && (
            <Field label="Total rows" hint="Rows done comes from the first counter in your Row Counter.">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className={inputClass}
                value={form.rowsTotal || ''}
                onChange={(e) => set('rowsTotal', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                placeholder="e.g. 120"
              />
            </Field>
          )}
        </Section>

        <Section title="Notes">
          <textarea
            className={`${inputClass} min-h-36 py-3 leading-relaxed`}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="e.g. Used size 7 for the cuffs"
          />
        </Section>

        <SaveBar onCancel={goBack} saving={saving} label={isNew ? 'Create project' : 'Save'} />
      </form>
    </>
  )
}
