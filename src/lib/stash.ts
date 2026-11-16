import { db, newId, type StashItem, type StoredFile } from '../db'
import { compressImage } from './images'
import { today } from './projects'

export const QUANTITY_UNITS: StashItem['quantityUnit'][] = ['skeins', 'balls', 'yards', 'meters', 'other']

export function blankStashItem(): StashItem {
  const now = Date.now()
  return {
    id: newId(),
    name: '',
    colorName: '',
    fiber: '',
    weight: '',
    quantity: 1,
    quantityUnit: 'skeins',
    dyeLot: '',
    location: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

/** "3 skeins", "1 skein", "450 yards". */
export function formatQuantity(s: Pick<StashItem, 'quantity' | 'quantityUnit'>): string {
  if (!s.quantity && s.quantity !== 0) return ''
  const n = Number.isInteger(s.quantity) ? String(s.quantity) : s.quantity.toFixed(1)
  if (s.quantityUnit === 'other') return n
  const unit = s.quantity === 1 ? s.quantityUnit.replace(/s$/, '') : s.quantityUnit
  return `${n} ${unit}`
}

export async function saveStashItem(item: StashItem, photo?: File | null, removePhoto = false) {
  let rec: StoredFile | undefined
  if (photo) {
    const img = await compressImage(photo)
    rec = {
      id: newId(),
      ownerType: 'stash',
      ownerId: item.id,
      kind: 'photo',
      blob: img.blob,
      thumb: img.thumb,
      mime: 'image/jpeg',
      width: img.width,
      height: img.height,
      date: today(),
      createdAt: Date.now(),
    }
  }
  await db.transaction('rw', db.stash, db.files, db.projects, async () => {
    const out: StashItem = { ...item, updatedAt: Date.now() }
    if (!out.reservedForProjectId) delete out.reservedForProjectId
    // Reserving yarn for a project also lists it in that project's materials.
    if (out.reservedForProjectId) {
      await db.projects.where('id').equals(out.reservedForProjectId).modify((p) => {
        if (!p.materials.stashIds.includes(item.id)) p.materials.stashIds.push(item.id)
      })
    }
    if ((rec || removePhoto) && item.photoFileId) {
      await db.files.delete(item.photoFileId)
      delete out.photoFileId
    }
    if (rec) {
      await db.files.add(rec)
      out.photoFileId = rec.id
    }
    await db.stash.put(out)
  })
}

export async function deleteStashItem(id: string) {
  await db.transaction('rw', db.stash, db.files, db.projects, async () => {
    await db.stash.delete(id)
    await db.files.where('ownerId').equals(id).delete()
    // Unlink it from any project that listed it.
    await db.projects
      .filter((p) => p.materials.stashIds.includes(id))
      .modify((p) => {
        p.materials.stashIds = p.materials.stashIds.filter((x) => x !== id)
      })
  })
}

/**
 * Keep "reserved for" in step with a project's picked yarn: newly picked,
 * unreserved items get reserved for it; unpicked items it held are released.
 * Must run inside a transaction that includes db.stash.
 */
export async function syncReservations(projectId: string, before: string[], after: string[]) {
  const added = after.filter((x) => !before.includes(x))
  const removed = before.filter((x) => !after.includes(x))
  if (added.length)
    await db.stash
      .where('id')
      .anyOf(added)
      .modify((s) => {
        if (!s.reservedForProjectId) s.reservedForProjectId = projectId
      })
  if (removed.length)
    await db.stash
      .where('id')
      .anyOf(removed)
      .modify((s) => {
        if (s.reservedForProjectId === projectId) delete s.reservedForProjectId
      })
}

/** Lower-case text used for search. */
export function stashSearchText(s: StashItem): string {
  return [s.name, s.colorName, s.fiber, s.weight, s.location, s.dyeLot, s.notes].join(' ').toLowerCase()
}
