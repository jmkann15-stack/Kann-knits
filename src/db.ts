import Dexie, { type EntityTable } from 'dexie'
import type { CRAFTS } from './config'

// Everything lives on the phone in IndexedDB. IDs are UUID strings so a
// backup can be restored without colliding with existing records.

export type Craft = (typeof CRAFTS)[number]
export type ProjectStatus = 'planned' | 'in_progress' | 'finished'
export type PatternSource = '' | 'book' | 'website' | 'own'
export type ProgressMode = 'none' | 'percent' | 'rows'

export interface Project {
  id: string
  name: string
  type: string
  craft: Craft
  status: ProjectStatus
  pattern: {
    name: string
    source: PatternSource
    detail: string // book title, URL, etc.
    fileId?: string // pattern photo or PDF in `files`
  }
  materials: {
    stashIds: string[] // linked Stash items
    yarnText: string // free-text yarn/thread
    needleSize: string
    meshCount: string
    gauge: string
  }
  madeFor: string // a family name, JUST_FOR_ME, or ''
  startDate?: string // YYYY-MM-DD
  finishDate?: string // YYYY-MM-DD
  notes: string
  coverFileId?: string
  progressMode: ProgressMode
  progressPercent: number
  rowsDone: number
  rowsTotal: number
  createdAt: number
  updatedAt: number
}

/** Photos and PDFs. Kept apart from records so lists stay fast. */
export interface StoredFile {
  id: string
  ownerType: 'project' | 'pattern' | 'stash' | 'design'
  ownerId: string
  kind: 'photo' | 'pdf'
  blob: Blob
  thumb?: Blob // ~480px JPEG for grids and cards (photos only)
  mime: string
  name?: string
  width?: number
  height?: number
  date: string // YYYY-MM-DD the photo is "for"
  caption?: string
  createdAt: number
}

export interface CounterReminder {
  id: string
  atRow: number // the (first) row it fires on
  message: string
  dismissed: boolean // one-time reminders: tapped "Got it"
  every?: number // repeating: fires every N rows from atRow…
  times?: number // …this many times in all (blank = keeps going)
  dismissedRow?: number // repeating: the row whose banner was last cleared
}

export interface Counter {
  id: string
  projectId: string
  name: string
  count: number
  order: number
  reminders: CounterReminder[]
  repeatRows?: number // pattern repeat length, e.g. a 12-row cable
  updatedAt: number
}

export interface StashItem {
  id: string
  name: string // name / brand
  colorName: string
  fiber: string
  weight: string // fingering, DK, worsted…
  quantity: number
  quantityUnit: 'skeins' | 'yards' | 'meters' | 'balls' | 'other'
  dyeLot: string
  location: string
  notes: string
  photoFileId?: string
  reservedForProjectId?: string
  createdAt: number
  updatedAt: number
}

export interface Design {
  id: string
  name: string
  projectId?: string
  cols: number
  rows: number
  palette: string[] // hex colors; index 0 is reserved as "empty"
  cells: string // one char per cell, base-36 palette index
  createdAt: number
  updatedAt: number
}

export interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('kann-knits') as Dexie & {
  projects: EntityTable<Project, 'id'>
  files: EntityTable<StoredFile, 'id'>
  counters: EntityTable<Counter, 'id'>
  stash: EntityTable<StashItem, 'id'>
  designs: EntityTable<Design, 'id'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  projects: 'id, status, madeFor, finishDate, updatedAt',
  files: 'id, [ownerType+ownerId], ownerId',
  counters: 'id, projectId',
  stash: 'id, weight, fiber, reservedForProjectId, updatedAt',
  designs: 'id, projectId, updatedAt',
  settings: 'key',
})

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
