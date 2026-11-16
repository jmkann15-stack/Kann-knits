import { db, newId, type Counter, type CounterReminder } from '../db'
import { blankCounter } from './projects'

// Every change is written to IndexedDB immediately, as an atomic modify,
// so rapid taps never lose a count and closing the app never loses one either.

const touch = (c: Counter) => {
  c.updatedAt = Date.now()
}

export async function bump(id: string, delta: number) {
  await db.counters
    .where('id')
    .equals(id)
    .modify((c) => {
      c.count = Math.max(0, c.count + delta)
      touch(c)
    })
}

export async function resetCounter(id: string) {
  await db.counters
    .where('id')
    .equals(id)
    .modify((c) => {
      c.count = 0
      // Reminders can fire again on the next pass.
      c.reminders = c.reminders.map((r) => ({ ...r, dismissed: false, dismissedRow: undefined }))
      touch(c)
    })
}

export async function setCount(id: string, count: number) {
  await db.counters.update(id, { count: Math.max(0, Math.floor(count)), updatedAt: Date.now() })
}

export async function addCounter(projectId: string, name: string): Promise<string> {
  const existing = await db.counters.where('projectId').equals(projectId).toArray()
  const order = existing.reduce((m, c) => Math.max(m, c.order), -1) + 1
  const c = blankCounter(projectId, name, order)
  await db.counters.add(c)
  return c.id
}

export async function renameCounter(id: string, name: string) {
  await db.counters.update(id, { name, updatedAt: Date.now() })
}

export async function deleteCounter(id: string) {
  await db.counters.delete(id)
}

export async function addReminder(
  id: string,
  atRow: number,
  message: string,
  repeat?: { every: number; times?: number },
) {
  const r: CounterReminder = { id: newId(), atRow, message, dismissed: false }
  if (repeat) {
    r.every = repeat.every
    if (repeat.times) r.times = repeat.times
  }
  await db.counters
    .where('id')
    .equals(id)
    .modify((c) => {
      c.reminders = [...c.reminders, r].sort((a, b) => a.atRow - b.atRow)
      touch(c)
    })
}

export async function removeReminder(id: string, reminderId: string) {
  await db.counters
    .where('id')
    .equals(id)
    .modify((c) => {
      c.reminders = c.reminders.filter((r) => r.id !== reminderId)
      touch(c)
    })
}

export async function setRepeatRows(id: string, rows: number | undefined) {
  await db.counters.update(id, { repeatRows: rows && rows > 1 ? rows : undefined, updatedAt: Date.now() })
}

/** Clears the banner. A repeating reminder only clears for this row; it comes back next time. */
export async function dismissReminder(id: string, reminderId: string, row: number) {
  await db.counters
    .where('id')
    .equals(id)
    .modify((c) => {
      c.reminders = c.reminders.map((r) =>
        r.id !== reminderId ? r : r.every ? { ...r, dismissedRow: row } : { ...r, dismissed: true },
      )
      touch(c)
    })
}

/** A reminder landing on a particular row. `n`/`of` number the times a repeating one fires. */
export interface ReminderHit {
  reminder: CounterReminder
  row: number
  n?: number
  of?: number
}

export const isRepeating = (r: CounterReminder) => !!r.every && r.every > 0

/** Which time (1-based) a repeating reminder fires on this row, if it does. */
function occurrenceAt(r: CounterReminder, row: number): number | undefined {
  if (!r.every || row < r.atRow) return undefined
  const k = (row - r.atRow) / r.every
  if (!Number.isInteger(k)) return undefined
  if (r.times && k >= r.times) return undefined
  return k + 1
}

/** The rows a repeating reminder is on, as words: "rows 40, 46, 52 … 82". */
export function describeRepeat(r: CounterReminder): string {
  if (!r.every) return `Row ${r.atRow}`
  if (!r.times) return `Every ${r.every} rows from row ${r.atRow}`
  const last = r.atRow + r.every * (r.times - 1)
  return `Every ${r.every} rows, ${r.times}× · rows ${r.atRow}–${last}`
}

/** How many times a repeating reminder has come up by this row. */
export function timesDone(r: CounterReminder, count: number): number {
  if (!r.every || count < r.atRow) return 0
  const k = Math.floor((count - r.atRow) / r.every) + 1
  return r.times ? Math.min(k, r.times) : k
}

export function repeatFinished(r: CounterReminder, count: number) {
  return !!r.every && !!r.times && timesDone(r, count) >= r.times
}

/** True when this row is one a reminder fires on (for the stronger buzz). */
export function reminderLandsOn(c: Counter, row: number) {
  return c.reminders.some((r) => (isRepeating(r) ? occurrenceAt(r, row) !== undefined : !r.dismissed && r.atRow === row))
}

/** The reminder to show now. One-time ones stay up until "Got it"; repeating ones show on their rows. */
export function activeReminder(c: Counter, count = c.count): ReminderHit | undefined {
  for (const r of c.reminders) {
    if (isRepeating(r)) {
      const n = occurrenceAt(r, count)
      if (n !== undefined && r.dismissedRow !== count) return { reminder: r, row: count, n, of: r.times }
    } else if (!r.dismissed && count >= r.atRow) {
      return { reminder: r, row: r.atRow }
    }
  }
  return undefined
}

/** The soonest reminder still ahead. */
export function nextReminder(c: Counter, count = c.count): ReminderHit | undefined {
  let best: ReminderHit | undefined
  for (const r of c.reminders) {
    let hit: ReminderHit | undefined
    if (isRepeating(r)) {
      const k = count < r.atRow ? 0 : Math.floor((count - r.atRow) / r.every!) + 1
      if (!r.times || k < r.times) hit = { reminder: r, row: r.atRow + k * r.every!, n: k + 1, of: r.times }
    } else if (!r.dismissed && r.atRow > count) {
      hit = { reminder: r, row: r.atRow }
    }
    if (hit && (!best || hit.row < best.row)) best = hit
  }
  return best
}

/** Where you are in a pattern repeat: row 5 of 12, repeat 3. */
export function repeatPosition(c: Counter, count: number) {
  const n = c.repeatRows
  if (!n || n < 2 || count < 1) return undefined
  return { row: ((count - 1) % n) + 1, of: n, repeat: Math.floor((count - 1) / n) + 1 }
}
