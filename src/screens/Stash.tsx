import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Project, type StashItem } from '../db'
import { FIBER_SUGGESTIONS, YARN_WEIGHTS } from '../config'
import {
  QUANTITY_UNITS,
  blankStashItem,
  deleteStashItem,
  formatQuantity,
  saveStashItem,
  stashSearchText,
} from '../lib/stash'
import { useObjectUrl } from '../lib/device'
import {
  Button,
  Choice,
  EmptyState,
  Field,
  InfoCard,
  InfoRow,
  PageHeader,
  SaveBar,
  Sheet,
  inputClass,
  useGoBack,
} from '../components/ui'
import { FileImage } from '../components/FileImage'
import { BasketIcon, CameraIcon, FilterIcon, PlusIcon, SearchIcon, XIcon, YarnBallArt } from '../components/Icons'

// ── Helpers ───────────────────────────────────────────────────

const norm = (s: string) => s.trim().toLowerCase()

/** Distinct, non-empty values (case-insensitive), sorted, keeping the first spelling seen. */
function distinct(values: string[]): string[] {
  const seen = new Map<string, string>()
  for (const v of values) if (v.trim() && !seen.has(norm(v))) seen.set(norm(v), v.trim())
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

function ReservedPill({ project }: { project?: Project }) {
  if (!project) return null
  const used = project.status === 'finished'
  return (
    <span
      className={`inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-sm font-bold ${
        used ? 'bg-oat text-ink-soft' : 'bg-heather-soft text-heather'
      }`}
    >
      {used ? 'Used in' : 'Saved for'} {project.name}
    </span>
  )
}

function StashThumb({ item, className }: { item: StashItem; className: string }) {
  return (
    <div className={`shrink-0 overflow-hidden bg-rose-soft ${className}`}>
      {item.photoFileId ? (
        <FileImage fileId={item.photoFileId} className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <YarnBallArt size={56} />
        </div>
      )}
    </div>
  )
}

// ── List ──────────────────────────────────────────────────────

type Show = 'all' | 'available' | 'reserved'

export function StashScreen() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const weight = params.get('w') ?? ''
  const fiber = params.get('fb') ?? ''
  const color = params.get('c') ?? ''
  const show = (params.get('show') as Show) || 'all'
  const [filtersOpen, setFiltersOpen] = useState(false)

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v && !(k === 'show' && v === 'all')) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  const data = useLiveQuery(async () => {
    const [items, projects] = await Promise.all([db.stash.toArray(), db.projects.toArray()])
    return { items, projects: new Map(projects.map((p) => [p.id, p])) }
  }, [])

  const items = data?.items ?? []
  const options = {
    weights: distinct(items.map((s) => s.weight)),
    fibers: distinct(items.map((s) => s.fiber)),
    colors: distinct(items.map((s) => s.colorName)),
  }

  const terms = norm(q).split(/\s+/).filter(Boolean)
  const shown = items
    .filter((s) => {
      if (weight && norm(s.weight) !== norm(weight)) return false
      if (fiber && norm(s.fiber) !== norm(fiber)) return false
      if (color && norm(s.colorName) !== norm(color)) return false
      if (show === 'available' && s.reservedForProjectId) return false
      if (show === 'reserved' && !s.reservedForProjectId) return false
      if (terms.length) {
        const text = stashSearchText(s)
        if (!terms.every((t) => text.includes(t))) return false
      }
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.colorName.localeCompare(b.colorName))

  const active: { key: string; label: string }[] = [
    weight && { key: 'w', label: weight },
    fiber && { key: 'fb', label: fiber },
    color && { key: 'c', label: color },
    show !== 'all' && { key: 'show', label: show === 'available' ? 'Not saved for anything' : 'Saved for a project' },
  ].filter(Boolean) as { key: string; label: string }[]

  return (
    <>
      <PageHeader
        title="Stash"
        subtitle={items.length ? `${items.length} ${items.length === 1 ? 'item' : 'items'}` : undefined}
      />

      {data && items.length === 0 ? (
        <EmptyState art={<BasketIcon size={56} strokeWidth={1.4} />} title="Your stash is empty">
          Tap <b className="text-rose">+</b> to add your yarn, thread and canvases, so you always know what you have,
          and what it’s saved for.
        </EmptyState>
      ) : (
        <>
          <div className="flex gap-2 px-5 pt-4">
            <label className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft">
                <SearchIcon size={22} />
              </span>
              <input
                type="search"
                value={q}
                onChange={(e) => update({ q: e.target.value })}
                placeholder="Search"
                aria-label="Search your stash"
                className={`${inputClass} pl-12`}
              />
            </label>
            <button
              onClick={() => setFiltersOpen(true)}
              className={`flex min-h-14 shrink-0 items-center gap-1.5 rounded-2xl border px-4 text-lg font-semibold ${
                active.length ? 'border-rose bg-rose text-white' : 'border-line bg-paper text-ink active:bg-oat'
              }`}
            >
              <FilterIcon size={22} />
              Filter{active.length > 0 && ` (${active.length})`}
            </button>
          </div>

          {active.length > 0 && (
            <div className="flex flex-wrap gap-2 px-5 pt-3">
              {active.map((a) => (
                <button
                  key={a.key}
                  onClick={() => update({ [a.key]: '' })}
                  className="flex min-h-12 items-center gap-1 rounded-full bg-rose-soft pr-3 pl-4 font-semibold text-rose-dark"
                  aria-label={`Remove filter ${a.label}`}
                >
                  {a.label}
                  <XIcon size={18} />
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3 px-5 pt-3 pb-28">
            {shown.map((s) => (
              <Link
                key={s.id}
                to={`/stash/${s.id}`}
                className="flex gap-4 rounded-3xl border border-line bg-paper p-3 active:bg-oat"
              >
                <StashThumb item={s} className="h-20 w-20 rounded-2xl" />
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                  <h2 className="line-clamp-2 text-xl leading-tight font-semibold break-words">
                    {s.name || 'Unnamed yarn'}
                  </h2>
                  <p className="line-clamp-2 text-ink-soft">
                    {[s.colorName, s.weight, s.fiber].filter(Boolean).join(' · ')}
                  </p>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {formatQuantity(s) && <span className="font-semibold">{formatQuantity(s)}</span>}
                    <ReservedPill project={s.reservedForProjectId ? data?.projects.get(s.reservedForProjectId) : undefined} />
                  </div>
                </div>
              </Link>
            ))}
            {data && shown.length === 0 && (
              <div className="px-4 pt-10 text-center text-lg leading-relaxed text-ink-soft">
                <p>Nothing matches that.</p>
                <Button variant="ghost" className="mt-2" onClick={() => setParams({}, { replace: true })}>
                  Show everything
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <Link
        to="/stash/new"
        aria-label="Add to stash"
        className="fixed right-5 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-rose text-white shadow-lg active:bg-rose-dark"
        style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
      >
        <PlusIcon size={32} strokeWidth={2.2} />
      </Link>

      <Sheet open={filtersOpen} title="Filter" onClose={() => setFiltersOpen(false)}>
        <div className="space-y-6">
          <FilterGroup label="Show">
            <Choice<Show>
              options={[
                { value: 'all', label: 'Everything' },
                { value: 'available', label: 'Not saved' },
                { value: 'reserved', label: 'Saved for a project' },
              ]}
              value={show}
              onChange={(v) => update({ show: v })}
            />
          </FilterGroup>
          <FilterChoices label="Weight" values={options.weights} value={weight} onChange={(v) => update({ w: v })} />
          <FilterChoices label="Fiber" values={options.fibers} value={fiber} onChange={(v) => update({ fb: v })} />
          <FilterChoices label="Color" values={options.colors} value={color} onChange={(v) => update({ c: v })} />
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => update({ w: '', fb: '', c: '', show: '' })}
            >
              Clear
            </Button>
            <Button className="flex-[2]" onClick={() => setFiltersOpen(false)}>
              Show {shown.length} {shown.length === 1 ? 'item' : 'items'}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  )
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 px-1 font-semibold">{label}</h3>
      {children}
    </div>
  )
}

function FilterChoices({
  label,
  values,
  value,
  onChange,
}: {
  label: string
  values: string[]
  value: string
  onChange: (v: string) => void
}) {
  if (values.length === 0) return null
  return (
    <FilterGroup label={label}>
      <Choice
        options={[{ value: '', label: 'Any' }, ...values.map((v) => ({ value: v, label: v }))]}
        value={values.find((v) => norm(v) === norm(value)) ?? ''}
        onChange={onChange}
      />
    </FilterGroup>
  )
}

// ── Detail ────────────────────────────────────────────────────

export function StashDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)

  const q = useLiveQuery(async () => {
    const s = await db.stash.get(id)
    if (!s) return { s }
    const [reservedFor, usedIn, photo] = await Promise.all([
      s.reservedForProjectId ? db.projects.get(s.reservedForProjectId) : undefined,
      db.projects.filter((p) => p.materials.stashIds.includes(id)).toArray(),
      s.photoFileId ? db.files.get(s.photoFileId) : undefined,
    ])
    return { s, reservedFor, usedIn, photo }
  }, [id])
  const photoUrl = useObjectUrl(photoOpen ? q?.photo?.blob : null)

  if (!q) return null
  if (!q.s) return <Navigate to="/stash" replace />
  const { s, reservedFor, usedIn = [] } = q
  const others = usedIn.filter((p) => p.id !== reservedFor?.id)

  return (
    <>
      <PageHeader
        title={s.name || 'Unnamed yarn'}
        subtitle={s.colorName || undefined}
        back="/stash"
        action={
          <Link
            to={`/stash/${s.id}/edit`}
            className="mb-1 flex min-h-12 shrink-0 items-center rounded-full px-4 text-lg font-semibold text-rose active:bg-rose-soft"
          >
            Edit
          </Link>
        }
      />
      <div className="px-5 pt-4 pb-10">
        {s.photoFileId ? (
          <button onClick={() => setPhotoOpen(true)} className="block w-full overflow-hidden rounded-3xl">
            <FileImage fileId={s.photoFileId} className="aspect-[4/3] w-full" alt={s.name} />
          </button>
        ) : (
          <Link
            to={`/stash/${s.id}/edit`}
            className="flex aspect-[5/2] w-full flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-line text-ink-soft active:bg-oat"
          >
            <CameraIcon size={32} />
            <span className="text-lg font-semibold">Add a photo</span>
          </Link>
        )}

        <InfoCard title="Details">
          <InfoRow label="Color">{s.colorName}</InfoRow>
          <InfoRow label="Weight">{s.weight}</InfoRow>
          <InfoRow label="Fiber">{s.fiber}</InfoRow>
          <InfoRow label="Amount">{formatQuantity(s)}</InfoRow>
          <InfoRow label="Dye lot">{s.dyeLot}</InfoRow>
          <InfoRow label="Stored">{s.location}</InfoRow>
        </InfoCard>

        <InfoCard title="Saved for">
          {reservedFor ? (
            <Link
              to={`/projects/${reservedFor.id}`}
              className="flex min-h-12 items-center text-lg font-semibold text-rose underline"
            >
              {reservedFor.name}
              {reservedFor.status === 'finished' && <span className="ml-1 font-normal text-ink-soft no-underline">(finished)</span>}
            </Link>
          ) : (
            <p className="text-lg text-ink-soft">Not saved for anything yet. Tap Edit to set it aside for a project.</p>
          )}
          {others.length > 0 && (
            <p className="pt-1 text-lg">
              <span className="text-ink-soft">Also listed in: </span>
              {others.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ', '}
                  <Link to={`/projects/${p.id}`} className="font-semibold text-rose underline">
                    {p.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </InfoCard>

        {s.notes && (
          <InfoCard title="Notes">
            <p className="text-lg leading-relaxed whitespace-pre-wrap">{s.notes}</p>
          </InfoCard>
        )}

        <Button variant="ghost" className="mt-8 w-full text-ink-soft" onClick={() => setConfirmDelete(true)}>
          Remove from stash
        </Button>
      </div>

      <Sheet open={photoOpen} title={s.name || 'Photo'} onClose={() => setPhotoOpen(false)}>
        {photoUrl && <img src={photoUrl} alt={s.name} className="w-full rounded-2xl" />}
      </Sheet>

      <Sheet open={confirmDelete} title="Remove this yarn?" onClose={() => setConfirmDelete(false)}>
        <p className="text-lg leading-relaxed text-ink-soft">
          “{s.name}”{s.photoFileId && ' and its photo'} will be removed from your stash
          {usedIn.length > 0 && ' and from any projects that list it'}. This can’t be undone.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button
            className="flex-1"
            onClick={async () => {
              await deleteStashItem(s.id)
              navigate('/stash', { replace: true })
            }}
          >
            Remove
          </Button>
        </div>
      </Sheet>
    </>
  )
}

// ── Add / edit ────────────────────────────────────────────────

export function StashFormScreen() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const goBack = useGoBack(id ? `/stash/${id}` : '/stash')

  const existingQ = useLiveQuery(async () => ({ s: id ? await db.stash.get(id) : undefined }), [id])
  const existing = existingQ?.s
  const others = useLiveQuery(() => db.stash.toArray(), [])
  const projects = useLiveQuery(() => db.projects.toArray(), [])

  const [form, setForm] = useState<StashItem | null>(() => (isNew ? blankStashItem() : null))
  const loaded = useRef(false)
  useEffect(() => {
    if (!isNew && existing && !loaded.current) {
      loaded.current = true
      setForm(structuredClone(existing))
    }
  }, [existing, isNew])

  const [photo, setPhoto] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [qtyText, setQtyText] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const photoPreview = useObjectUrl(photo)

  if (!isNew && !existingQ) return null
  if (!isNew && !existing) return <Navigate to="/stash" replace />
  if (!form) return null

  const set = <K extends keyof StashItem>(k: K, v: StashItem[K]) => setForm({ ...form, [k]: v })

  const weightOptions = form.weight && !YARN_WEIGHTS.includes(form.weight) ? [...YARN_WEIGHTS, form.weight] : YARN_WEIGHTS
  const fiberList = distinct([...FIBER_SUGGESTIONS, ...(others ?? []).map((s) => s.fiber)])
  const locationList = distinct((others ?? []).map((s) => s.location))
  // Projects still in the works, plus whatever it's already saved for.
  const projectOptions = (projects ?? [])
    .filter((p) => p.status !== 'finished' || p.id === form.reservedForProjectId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const save = async () => {
    if (!form.name.trim()) {
      setError('Give it a name or brand first.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true)
    try {
      const qty = qtyText === null ? form.quantity : parseFloat(qtyText.replace(',', '.'))
      const item: StashItem = {
        ...form,
        name: form.name.trim(),
        colorName: form.colorName.trim(),
        fiber: form.fiber.trim(),
        location: form.location.trim(),
        quantity: Number.isFinite(qty) && qty >= 0 ? qty : 0,
      }
      await saveStashItem(item, photo, removePhoto)
      if (isNew) navigate(`/stash/${item.id}`, { replace: true })
      else goBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving.')
      setSaving(false)
    }
  }

  const hasPhoto = !!photo || (!!form.photoFileId && !removePhoto)

  return (
    <>
      <PageHeader title={isNew ? 'Add to stash' : 'Edit yarn'} back={id ? `/stash/${id}` : '/stash'} />
      <form
        className="space-y-5 px-5 pt-5 pb-32"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {error && <p className="rounded-2xl bg-rose-soft p-4 text-lg text-rose-dark">{error}</p>}

        <div>
          <label className="block cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed border-line bg-paper active:bg-oat">
            {photo && photoPreview ? (
              <img src={photoPreview} alt="" className="aspect-[4/3] w-full object-cover" />
            ) : hasPhoto ? (
              <FileImage fileId={form.photoFileId} className="aspect-[4/3] w-full" />
            ) : (
              <span className="flex aspect-[5/2] flex-col items-center justify-center gap-1 text-ink-soft">
                <CameraIcon size={32} />
                <span className="text-lg font-semibold">Add a photo</span>
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setPhoto(f)
                  setRemovePhoto(false)
                }
                e.target.value = ''
              }}
            />
          </label>
          {hasPhoto && (
            <button
              type="button"
              className="mt-1 min-h-12 px-1 font-semibold text-ink-soft"
              onClick={() => {
                setPhoto(null)
                setRemovePhoto(true)
              }}
            >
              Remove photo
            </button>
          )}
        </div>

        <Field label="Name or brand">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => {
              set('name', e.target.value)
              setError('')
            }}
            placeholder="e.g. Cascade 220"
            autoComplete="off"
          />
        </Field>
        <Field label="Color">
          <input
            className={inputClass}
            value={form.colorName}
            onChange={(e) => set('colorName', e.target.value)}
            placeholder="e.g. Oatmeal"
            autoComplete="off"
          />
        </Field>
        <Field label="Weight">
          <Choice
            options={[{ value: '', label: 'Not sure' }, ...weightOptions.map((w) => ({ value: w, label: w }))]}
            value={form.weight}
            onChange={(v) => set('weight', v)}
          />
        </Field>
        <Field label="Fiber">
          <input
            className={inputClass}
            value={form.fiber}
            onChange={(e) => set('fiber', e.target.value)}
            placeholder="e.g. Wool"
            list="fiber-list"
            autoComplete="off"
          />
          <datalist id="fiber-list">
            {fiberList.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        <Field label="How much">
          <div className="flex gap-2">
            <div className="w-28 shrink-0">
              <input
                className={`${inputClass} text-center`}
                inputMode="decimal"
                value={qtyText ?? String(form.quantity)}
                onChange={(e) => setQtyText(e.target.value)}
                onFocus={(e) => e.target.select()}
                aria-label="Amount"
              />
            </div>
            <select
              className={`${inputClass} min-w-0 flex-1`}
              value={form.quantityUnit}
              onChange={(e) => set('quantityUnit', e.target.value as StashItem['quantityUnit'])}
              aria-label="Unit"
            >
              {QUANTITY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u[0].toUpperCase() + u.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </Field>
        <Field label="Dye lot" hint="Handy for matching skeins later.">
          <input
            className={inputClass}
            value={form.dyeLot}
            onChange={(e) => set('dyeLot', e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="Where it’s stored">
          <input
            className={inputClass}
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="e.g. Blue bin, hall closet"
            list="location-list"
            autoComplete="off"
          />
          <datalist id="location-list">
            {locationList.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
        <Field label="Saved for a project">
          <select
            className={inputClass}
            value={form.reservedForProjectId ?? ''}
            onChange={(e) => set('reservedForProjectId', e.target.value || undefined)}
          >
            <option value="">Not saved for anything</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <textarea
            className={`${inputClass} min-h-32 py-3 leading-relaxed`}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="e.g. Gift from Aunt Sue, soft enough for a baby blanket"
          />
        </Field>

        <SaveBar onCancel={goBack} saving={saving} label={isNew ? 'Add to stash' : 'Save'} />
      </form>
    </>
  )
}
