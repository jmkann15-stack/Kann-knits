import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Counter } from '../db'
import {
  activeReminder,
  addCounter,
  addReminder,
  bump,
  deleteCounter,
  dismissReminder,
  nextReminder,
  removeReminder,
  renameCounter,
  resetCounter,
  setCount,
} from '../lib/counters'
import { haptic, useWakeLock } from '../lib/device'
import { Button, Field, Sheet, inputClass, useGoBack } from '../components/ui'
import { ChevronLeft, PlusIcon, TrashIcon } from '../components/Icons'

type SheetKind = null | 'add' | 'more' | 'reminders' | 'reset'

/** Name entry used for both "add counter" and "rename". */
function NameForm({ initial, submitLabel, onSubmit }: { initial: string; submitLabel: string; onSubmit: (v: string) => void }) {
  const [v, setV] = useState(initial)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim()) onSubmit(v.trim())
      }}
      className="space-y-3"
    >
      <input
        className={inputClass}
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="e.g. Decrease every 6th row"
        autoFocus
        autoCapitalize="sentences"
        enterKeyHint="done"
      />
      <Button type="submit" className="w-full" disabled={!v.trim()}>
        {submitLabel}
      </Button>
    </form>
  )
}

function RemindersSheet({ counter, onClose }: { counter: Counter; onClose: () => void }) {
  const [row, setRow] = useState('')
  const [msg, setMsg] = useState('')
  const n = Math.floor(Number(row))
  const valid = Number.isFinite(n) && n > 0 && msg.trim()
  return (
    <Sheet open title={`Reminders · ${counter.name}`} onClose={onClose}>
      <p className="mb-4 text-lg text-ink-soft">A banner pops up when you reach the row, like “at row 40, start the decrease.”</p>
      {counter.reminders.length > 0 && (
        <ul className="mb-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {counter.reminders.map((r) => (
            <li key={r.id} className="flex min-h-16 items-center gap-3 pl-4">
              <span className="w-20 shrink-0 font-serif text-lg font-semibold text-rose-dark">Row {r.atRow}</span>
              <span className={`flex-1 text-lg ${r.dismissed ? 'text-ink-soft line-through' : ''}`}>{r.message}</span>
              <button
                aria-label={`Delete reminder at row ${r.atRow}`}
                onClick={() => removeReminder(counter.id, r.id)}
                className="flex h-14 w-14 items-center justify-center text-ink-soft"
              >
                <TrashIcon size={22} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!valid) return
          await addReminder(counter.id, n, msg.trim())
          setRow('')
          setMsg('')
        }}
      >
        <div className="flex gap-3">
          <div className="w-28 shrink-0">
            <Field label="At row">
              <input
                className={inputClass}
                type="number"
                inputMode="numeric"
                min={1}
                value={row}
                onChange={(e) => setRow(e.target.value)}
                placeholder="40"
              />
            </Field>
          </div>
          <div className="min-w-0 flex-1">
            <Field label="Reminder">
              <input
                className={inputClass}
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Start the decrease"
                autoCapitalize="sentences"
              />
            </Field>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={!valid}>
          Add reminder
        </Button>
      </form>
    </Sheet>
  )
}

export function CounterScreen() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const goBack = useGoBack(`/projects/${id}`)
  const wake = useWakeLock()

  const q = useLiveQuery(async () => {
    const p = await db.projects.get(id)
    const counters = p ? await db.counters.where('projectId').equals(id).sortBy('order') : []
    return { p, counters }
  }, [id])

  // Optimistic display so taps feel instant; the database write follows immediately.
  const [pending, setPending] = useState<{ id: string; value: number } | null>(null)
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [renaming, setRenaming] = useState(false)
  const [settingCount, setSettingCount] = useState('')

  const counters = q?.counters ?? []
  const selectedId = params.get('c')
  const counter = counters.find((c) => c.id === selectedId) ?? counters[0]
  const live = counter?.count ?? 0
  const shown = pending && counter && pending.id === counter.id ? pending.value : live
  // Latest value, readable by taps that land before React re-renders.
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    if (pending && counter && pending.id === counter.id && live === pending.value) setPending(null)
  }, [live, pending, counter])

  // Older projects could have no counters; make sure there's always one.
  const creating = useRef(false)
  useEffect(() => {
    if (q?.p && q.counters.length === 0 && !creating.current) {
      creating.current = true
      addCounter(id, 'Rows').finally(() => (creating.current = false))
    }
  }, [q, id])

  if (!q) return null
  if (!q.p) return <Navigate to="/" replace />
  if (!counter) return null
  const project = q.p

  const reminder = activeReminder(counter, shown)
  const upcoming = nextReminder(counter, shown)
  const isMain = counter.id === counters[0]?.id
  const total = isMain && project.progressMode === 'rows' && project.rowsTotal > 0 ? project.rowsTotal : 0

  const change = (delta: number) => {
    const cur = shownRef.current
    const next = Math.max(0, cur + delta)
    if (next === cur) return
    shownRef.current = next
    setPending({ id: counter.id, value: next })
    const hitsReminder = delta > 0 && counter.reminders.some((r) => !r.dismissed && r.atRow === next)
    haptic(hitsReminder ? 60 : 12)
    bump(counter.id, delta).catch(() => setPending(null))
  }

  const select = (cid: string) => setParams(cid === counters[0]?.id ? {} : { c: cid }, { replace: true })

  return (
    <div className="pt-safe pb-safe fixed inset-0 flex flex-col bg-cream select-none">
      {/* Top bar */}
      <div className="flex items-center gap-1 px-3 pt-2">
        <button
          onClick={goBack}
          aria-label="Back to project"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-rose active:bg-rose-soft"
        >
          <ChevronLeft size={28} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{project.name || 'Row Counter'}</h1>
        {wake === 'active' && (
          <span className="shrink-0 rounded-full bg-rose-soft px-3 py-1 text-sm font-semibold text-rose-dark">
            Screen stays on
          </span>
        )}
      </div>

      {/* Counter tabs */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-2 pb-2">
        {counters.map((c) => (
          <button
            key={c.id}
            onClick={() => select(c.id)}
            className={`min-h-12 shrink-0 rounded-full border px-4 text-base font-semibold whitespace-nowrap ${
              c.id === counter.id ? 'border-rose bg-rose text-white' : 'border-line bg-paper text-ink active:bg-oat'
            }`}
          >
            {c.name}
            <span className={`ml-1.5 ${c.id === counter.id ? 'text-white/80' : 'text-ink-soft'}`}>
              {c.id === counter.id ? shown : c.count}
            </span>
          </button>
        ))}
        <button
          onClick={() => setSheet('add')}
          aria-label="Add a counter"
          className="flex min-h-12 shrink-0 items-center gap-1 rounded-full border border-dashed border-rose px-4 font-semibold text-rose active:bg-rose-soft"
        >
          <PlusIcon size={20} /> Counter
        </button>
      </div>

      {/* Reminder banner */}
      {reminder && (
        <div role="alert" className="animate-rise mx-4 mb-2 flex items-center gap-3 rounded-2xl bg-heather p-4 text-white shadow-md">
          <span className="text-2xl">🔔</span>
          <span className="flex-1 text-lg leading-snug">
            <b>Row {reminder.atRow}:</b> {reminder.message}
          </span>
          <button
            onClick={() => dismissReminder(counter.id, reminder.id)}
            className="min-h-12 shrink-0 rounded-xl bg-white/20 px-4 font-semibold active:bg-white/30"
          >
            Got it
          </button>
        </div>
      )}

      {/* The big tap area */}
      <button
        onClick={() => change(1)}
        aria-label={`${counter.name}: ${shown}. Tap to add a row.`}
        className="mx-4 flex flex-1 flex-col items-center justify-center rounded-[2rem] bg-rose text-white shadow-lg transition-transform active:scale-[0.985] active:bg-rose-dark"
        style={{ touchAction: 'manipulation' }}
      >
        <span className="text-lg font-semibold tracking-wide text-white/80 uppercase">{counter.name}</span>
        <span className="font-serif text-[clamp(6rem,32vw,11rem)] leading-none font-semibold tabular-nums">{shown}</span>
        {total > 0 && <span className="text-xl text-white/85">of {total} rows</span>}
        <span className="mt-3 text-lg text-white/75">Tap anywhere to count</span>
        {upcoming && !reminder && (
          <span className="mt-4 rounded-full bg-white/15 px-4 py-1.5 text-base">
            Next: row {upcoming.atRow} · {upcoming.message}
          </span>
        )}
      </button>

      {/* Controls */}
      <div className="grid grid-cols-4 gap-2 px-4 pt-3 pb-3">
        <button
          onClick={() => change(-1)}
          disabled={shown === 0}
          className="min-h-16 rounded-2xl border border-line bg-paper font-serif text-2xl font-semibold text-ink active:bg-oat disabled:opacity-40"
        >
          −1
        </button>
        <button
          onClick={() => setSheet('reminders')}
          className="relative min-h-16 rounded-2xl border border-line bg-paper text-base font-semibold text-ink active:bg-oat"
        >
          Reminders
          {counter.reminders.some((r) => !r.dismissed) && (
            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-rose" />
          )}
        </button>
        <button
          onClick={() => setSheet('reset')}
          className="min-h-16 rounded-2xl border border-line bg-paper text-base font-semibold text-ink active:bg-oat"
        >
          Reset
        </button>
        <button
          onClick={() => {
            setRenaming(false)
            setSettingCount('')
            setSheet('more')
          }}
          className="min-h-16 rounded-2xl border border-line bg-paper text-base font-semibold text-ink active:bg-oat"
        >
          More
        </button>
      </div>
      {wake === 'unsupported' && (
        <p className="px-6 pb-2 text-center text-sm text-ink-soft">
          Tip: to keep the screen on, set Settings → Display &amp; Brightness → Auto-Lock to “Never” while you knit.
        </p>
      )}

      {/* Sheets */}
      <Sheet open={sheet === 'add'} title="New counter" onClose={() => setSheet(null)}>
        <p className="mb-3 text-lg text-ink-soft">For things like “Repeats” or “Decrease every 6th row.”</p>
        <NameForm
          initial=""
          submitLabel="Add counter"
          onSubmit={async (name) => {
            const cid = await addCounter(id, name)
            select(cid)
            setSheet(null)
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'reset'} title={`Reset ${counter.name}?`} onClose={() => setSheet(null)}>
        <p className="mb-5 text-lg">
          This sets <b>{counter.name}</b> back to 0 from <b>{shown}</b>. Your reminders for this counter will show again.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setSheet(null)}>
            Keep counting
          </Button>
          <Button
            className="flex-1"
            onClick={async () => {
              setPending(null)
              await resetCounter(counter.id)
              setSheet(null)
            }}
          >
            Reset to 0
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'more'} title={counter.name} onClose={() => setSheet(null)}>
        {renaming ? (
          <NameForm
            initial={counter.name}
            submitLabel="Save name"
            onSubmit={async (name) => {
              await renameCounter(counter.id, name)
              setSheet(null)
            }}
          />
        ) : (
          <div className="space-y-5">
            <form
              className="flex items-end gap-3"
              onSubmit={async (e) => {
                e.preventDefault()
                const n = Math.floor(Number(settingCount))
                if (!Number.isFinite(n) || n < 0 || settingCount === '') return
                setPending(null)
                await setCount(counter.id, n)
                setSheet(null)
              }}
            >
              <div className="min-w-0 flex-1">
                <Field label="Set the count" hint="Handy if you lost track.">
                  <input
                    className={inputClass}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={settingCount}
                    onChange={(e) => setSettingCount(e.target.value)}
                    placeholder={String(shown)}
                  />
                </Field>
              </div>
              <Button type="submit" className="mb-7" disabled={settingCount === ''}>
                Set
              </Button>
            </form>
            <Button variant="secondary" className="w-full" onClick={() => setRenaming(true)}>
              Rename counter
            </Button>
            {counters.length > 1 && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={async () => {
                  if (!confirm(`Delete the “${counter.name}” counter? This can’t be undone.`)) return
                  setSheet(null)
                  setParams({}, { replace: true })
                  await deleteCounter(counter.id)
                }}
              >
                Delete counter
              </Button>
            )}
          </div>
        )}
      </Sheet>

      {sheet === 'reminders' && <RemindersSheet counter={counter} onClose={() => setSheet(null)} />}
    </div>
  )
}
