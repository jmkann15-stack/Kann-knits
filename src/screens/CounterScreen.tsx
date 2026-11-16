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
  describeRepeat,
  dismissReminder,
  isRepeating,
  nextReminder,
  reminderLandsOn,
  removeReminder,
  renameCounter,
  repeatFinished,
  repeatPosition,
  resetCounter,
  setCount,
  setRepeatRows,
  timesDone,
  type ReminderHit,
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

/** "40, 46, 52 … 82" */
const previewRows = (first: number, every: number, times: number) => {
  const rows = Array.from({ length: Math.min(times, 4) }, (_, i) => first + i * every)
  return times > 4 ? `${rows.slice(0, 3).join(', ')} … ${first + every * (times - 1)}` : rows.join(', ')
}

const toInt = (v: string) => {
  const n = Math.floor(Number(v))
  return v.trim() !== '' && Number.isFinite(n) ? n : NaN
}

/** "Decrease (3 of 8)" — the reminder's words plus which time this is. */
const hitLabel = (h: ReminderHit) => (h.n ? `${h.reminder.message} (${h.of ? `${h.n} of ${h.of}` : `#${h.n}`})` : h.reminder.message)

function RemindersSheet({ counter, count, onClose }: { counter: Counter; count: number; onClose: () => void }) {
  const [row, setRow] = useState('')
  const [msg, setMsg] = useState('')
  const [repeats, setRepeats] = useState(false)
  const [every, setEvery] = useState('')
  const [times, setTimes] = useState('')
  const n = toInt(row)
  const e = toInt(every)
  const t = toInt(times)
  const valid = n > 0 && !!msg.trim() && (!repeats || (e > 0 && (times.trim() === '' || t > 0)))
  const lastRow = repeats && e > 0 && t > 0 && n > 0

  return (
    <Sheet open title={`Reminders · ${counter.name}`} onClose={onClose}>
      <p className="mb-4 text-lg text-ink-soft">
        A banner pops up on the row, like “at row 40, start the neck” or “decrease every 6th row, 8 times.”
      </p>
      {counter.reminders.length > 0 && (
        <ul className="mb-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {counter.reminders.map((r) => {
            const rep = isRepeating(r)
            const done = rep ? repeatFinished(r, count) : r.dismissed
            return (
              <li key={r.id} className="flex min-h-16 items-center gap-3 py-2 pl-4">
                <div className="min-w-0 flex-1">
                  <span className={`block text-lg leading-snug ${done ? 'text-ink-soft line-through' : ''}`}>{r.message}</span>
                  <span className="block text-sm text-rose-dark">
                    {describeRepeat(r)}
                    {rep && r.times && ` · ${timesDone(r, count)} of ${r.times} done`}
                  </span>
                </div>
                <button
                  aria-label={`Delete reminder: ${r.message}`}
                  onClick={() => removeReminder(counter.id, r.id)}
                  className="flex h-14 w-14 shrink-0 items-center justify-center text-ink-soft"
                >
                  <TrashIcon size={22} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <form
        className="space-y-3"
        onSubmit={async (ev) => {
          ev.preventDefault()
          if (!valid) return
          await addReminder(counter.id, n, msg.trim(), repeats ? { every: e, times: t > 0 ? t : undefined } : undefined)
          setRow('')
          setMsg('')
          setEvery('')
          setTimes('')
        }}
      >
        <Field label="Reminder">
          <input
            className={inputClass}
            value={msg}
            onChange={(ev) => setMsg(ev.target.value)}
            placeholder={repeats ? 'Decrease at each end' : 'Start the decrease'}
            autoCapitalize="sentences"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="How often">
          {[false, true].map((v) => (
            <button
              type="button"
              key={String(v)}
              aria-pressed={repeats === v}
              onClick={() => setRepeats(v)}
              className={`min-h-12 rounded-full border px-3 font-semibold ${
                repeats === v ? 'border-rose bg-rose text-white' : 'border-line bg-paper text-ink active:bg-oat'
              }`}
            >
              {v ? 'Repeats' : 'Just once'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <Field label={repeats ? 'First row' : 'At row'}>
            <input
              className={inputClass}
              type="number"
              inputMode="numeric"
              min={1}
              value={row}
              onChange={(ev) => setRow(ev.target.value)}
              placeholder="40"
            />
          </Field>
          {repeats && (
            <>
              <Field label="Every (rows)">
                <input
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={every}
                  onChange={(ev) => setEvery(ev.target.value)}
                  placeholder="6"
                  aria-label="Every how many rows"
                />
              </Field>
              <Field label="Times">
                <input
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={times}
                  onChange={(ev) => setTimes(ev.target.value)}
                  placeholder="8"
                  aria-label="How many times"
                />
              </Field>
            </>
          )}
        </div>
        {repeats && (
          <p className="px-1 text-sm text-ink-soft">
            {lastRow
              ? `On rows ${previewRows(n, e, t)}.`
              : 'Leave Times blank to keep repeating, e.g. a cable crossed every 8 rows.'}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={!valid}>
          Add reminder
        </Button>
      </form>
    </Sheet>
  )
}

/** Pattern repeat length, e.g. a 12-row cable: the counter then shows "row 5 of 12". */
function RepeatForm({ counter, onSaved }: { counter: Counter; onSaved: () => void }) {
  const [v, setV] = useState(counter.repeatRows ? String(counter.repeatRows) : '')
  const n = toInt(v)
  const changed = (counter.repeatRows ?? 0) !== (n > 1 ? n : 0)
  return (
    <form
      className="flex items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        await setRepeatRows(counter.id, n > 1 ? n : undefined)
        onSaved()
      }}
    >
      <div className="min-w-0 flex-1">
        <Field label="Pattern repeat (rows)" hint="For a 12-row cable or lace repeat, shows “row 5 of 12”. Blank = off.">
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            min={2}
            value={v}
            onChange={(e) => setV(e.target.value)}
            placeholder="12"
          />
        </Field>
      </div>
      <Button type="submit" className="mb-7" disabled={!changed || (v.trim() !== '' && !(n > 1))}>
        Save
      </Button>
    </form>
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
  const position = repeatPosition(counter, shown)
  const total = isMain && project.progressMode === 'rows' && project.rowsTotal > 0 ? project.rowsTotal : 0

  const change = (delta: number) => {
    const cur = shownRef.current
    const next = Math.max(0, cur + delta)
    if (next === cur) return
    shownRef.current = next
    setPending({ id: counter.id, value: next })
    const hitsReminder = delta > 0 && reminderLandsOn(counter, next)
    haptic(hitsReminder ? 60 : 12)
    bump(counter.id, delta).catch(() => setPending(null))
  }

  const select = (cid: string) => setParams(cid === counters[0]?.id ? {} : { c: cid }, { replace: true })

  return (
    <div className="pt-safe pb-safe fixed inset-0 flex flex-col bg-cream select-none">
      {/* Top bar */}
      <div className="flex items-center gap-1 px-3 pt-4">
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
            <b>Row {reminder.row}:</b> {hitLabel(reminder)}
          </span>
          <button
            onClick={() => dismissReminder(counter.id, reminder.reminder.id, reminder.row)}
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
        {position && (
          <span className="mt-1 text-xl font-semibold text-white/90">
            Row {position.row} of {position.of} · repeat {position.repeat}
          </span>
        )}
        <span className="mt-3 text-lg text-white/75">Tap anywhere to count</span>
        {upcoming && !reminder && (
          <span className="mt-4 rounded-full bg-white/15 px-4 py-1.5 text-base">
            Next: row {upcoming.row}
            {upcoming.row - shown <= 10 && ` (in ${upcoming.row - shown})`} · {hitLabel(upcoming)}
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
          {counter.reminders.some((r) => (isRepeating(r) ? !repeatFinished(r, shown) : !r.dismissed)) && (
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
            <RepeatForm counter={counter} onSaved={() => setSheet(null)} />
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

      {sheet === 'reminders' && <RemindersSheet counter={counter} count={shown} onClose={() => setSheet(null)} />}
    </div>
  )
}
