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
      c.reminders = c.reminders.map((r) => ({ ...r, dismissed: false }))
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

export async function addReminder(id: string, atRow: number, message: string) {
  const r: CounterReminder = { id: newId(), atRow, message, dismissed: false }
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

export async function dismissReminder(id: string, reminderId: string) {
  await db.counters
    .where('id')
    .equals(id)
    .modify((c) => {
      c.reminders = c.reminders.map((r) => (r.id === reminderId ? { ...r, dismissed: true } : r))
      touch(c)
    })
}

/** The reminder to show now: reached, not yet dismissed. */
export function activeReminder(c: Counter, count = c.count): CounterReminder | undefined {
  return c.reminders.find((r) => !r.dismissed && count >= r.atRow)
}

/** The next reminder still ahead. */
export function nextReminder(c: Counter, count = c.count): CounterReminder | undefined {
  return c.reminders.find((r) => !r.dismissed && r.atRow > count)
}
