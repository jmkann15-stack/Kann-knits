import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCachedLiveQuery } from '../lib/useCached'
import { db, type Design } from '../db'
import { MAX_SIDE, SIZE_PRESETS, blankDesign, createDesign, decodeCells, drawDesign } from '../lib/designs'
import { formatDate } from '../lib/projects'
import { EmptyState, Field, PageHeader, SaveBar, inputClass, useGoBack } from '../components/ui'
import { GridIcon, PlusIcon } from '../components/Icons'

const localDay = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A small picture of a design (no grid lines), scaled to fit its box. */
export function DesignThumb({ design, className = '' }: { design: Design; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const cell = Math.max(1, Math.min(8, Math.ceil(240 / Math.max(design.cols, design.rows))))
    drawDesign(ref.current, design, decodeCells(design), cell, false)
  }, [design])
  return (
    <div className={`flex items-center justify-center overflow-hidden bg-oat ${className}`}>
      <canvas
        ref={ref}
        className="max-h-full max-w-full border border-line"
        style={{ imageRendering: 'pixelated' }}
        aria-hidden="true"
      />
    </div>
  )
}

export function DesignsScreen() {
  const data = useCachedLiveQuery('designs-list', async () => {
    const [designs, projects] = await Promise.all([db.designs.orderBy('updatedAt').reverse().toArray(), db.projects.toArray()])
    return { designs, names: new Map(projects.map((p) => [p.id, p.name])) }
  }, [])
  const designs = data?.designs ?? []

  return (
    <>
      <PageHeader title="Designs" subtitle="Graph paper for your own patterns" back="/" />
      {!data ? null : designs.length === 0 ? (
        <EmptyState art={<GridIcon size={56} strokeWidth={1.4} />} title="No designs yet">
          Tap <b className="text-rose">+</b> to start on graph paper: a monogram belt, a pillow, a colorwork chart.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-5 pt-4 pb-28">
          {designs.map((d) => (
            <Link
              key={d.id}
              to={`/designs/${d.id}`}
              className="block overflow-hidden rounded-3xl border border-line bg-paper active:bg-oat"
            >
              <DesignThumb design={d} className="aspect-square w-full p-3" />
              <div className="p-3">
                <h2 className="line-clamp-2 text-lg leading-tight font-semibold break-words">
                  {d.name || 'Untitled design'}
                </h2>
                <p className="text-sm text-ink-soft">
                  {d.cols} × {d.rows}
                  {d.projectId && data?.names.get(d.projectId) && ` · ${data.names.get(d.projectId)}`}
                </p>
                <p className="text-sm text-ink-soft">Edited {formatDate(localDay(d.updatedAt))}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Link
        to="/designs/new"
        aria-label="New design"
        className="fixed right-5 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-rose text-white shadow-lg active:bg-rose-dark"
        style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
      >
        <PlusIcon size={32} strokeWidth={2.2} />
      </Link>
    </>
  )
}

export function DesignNewScreen() {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const goBack = useGoBack('/designs')
  const projects = useLiveQuery(() => db.projects.toArray(), [])

  const [name, setName] = useState('')
  const [preset, setPreset] = useState<number | 'custom'>(0)
  const [cols, setCols] = useState('40')
  const [rows, setRows] = useState('40')
  const [projectId, setProjectId] = useState(search.get('project') ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const size = useMemo(() => {
    if (preset !== 'custom') return SIZE_PRESETS[preset]
    return { cols: parseInt(cols, 10), rows: parseInt(rows, 10) }
  }, [preset, cols, rows])

  const projectOptions = (projects ?? [])
    .filter((p) => p.status !== 'finished' || p.id === projectId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const create = async () => {
    const ok = (n: number) => Number.isInteger(n) && n >= 2 && n <= MAX_SIDE
    if (!ok(size.cols) || !ok(size.rows)) {
      setError(`Width and height need to be between 2 and ${MAX_SIDE} squares.`)
      return
    }
    setSaving(true)
    const d = blankDesign(size.cols, size.rows, name.trim(), projectId || undefined)
    await createDesign(d)
    navigate(`/designs/${d.id}`, { replace: true })
  }

  return (
    <>
      <PageHeader title="New design" back="/designs" />
      <form
        className="space-y-5 px-5 pt-5 pb-32"
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
      >
        {error && <p className="rounded-2xl bg-rose-soft p-4 text-lg text-rose-dark">{error}</p>}
        <Field label="Name">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dad’s monogram belt"
            autoComplete="off"
          />
        </Field>

        <div>
          <span className="mb-1.5 block px-1 font-semibold">Size (squares wide × tall)</span>
          <div className="grid grid-cols-2 gap-2">
            {SIZE_PRESETS.map((p, i) => (
              <button
                type="button"
                key={p.label}
                onClick={() => {
                  setPreset(i)
                  setError('')
                }}
                aria-pressed={preset === i}
                className={`min-h-16 rounded-2xl border px-3 text-left ${
                  preset === i ? 'border-rose bg-rose text-white' : 'border-line bg-paper active:bg-oat'
                }`}
              >
                <span className="block font-semibold">{p.label}</span>
                <span className={`block text-sm ${preset === i ? 'text-white/85' : 'text-ink-soft'}`}>
                  {p.cols} × {p.rows}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPreset('custom')}
              aria-pressed={preset === 'custom'}
              className={`col-span-2 min-h-14 rounded-2xl border px-3 font-semibold ${
                preset === 'custom' ? 'border-rose bg-rose text-white' : 'border-line bg-paper active:bg-oat'
              }`}
            >
              Custom size
            </button>
          </div>
          {preset === 'custom' && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-28 shrink-0">
                <input
                  className={`${inputClass} text-center`}
                  inputMode="numeric"
                  value={cols}
                  onChange={(e) => {
                    setCols(e.target.value.replace(/\D/g, ''))
                    setError('')
                  }}
                  aria-label="Squares wide"
                />
              </div>
              <span className="text-lg text-ink-soft">wide ×</span>
              <div className="w-28 shrink-0">
                <input
                  className={`${inputClass} text-center`}
                  inputMode="numeric"
                  value={rows}
                  onChange={(e) => {
                    setRows(e.target.value.replace(/\D/g, ''))
                    setError('')
                  }}
                  aria-label="Squares tall"
                />
              </div>
              <span className="text-lg text-ink-soft">tall</span>
            </div>
          )}
          <p className="mt-2 px-1 text-sm text-ink-soft">
            Tip: one square = one stitch. A needlepoint belt is usually about 18–20 squares tall.
          </p>
        </div>

        <Field label="For a project (optional)">
          <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Not attached</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <SaveBar onCancel={goBack} saving={saving} label="Start designing" />
      </form>
    </>
  )
}
