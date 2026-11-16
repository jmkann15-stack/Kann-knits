import { db, newId, type Design } from '../db'
import { shareOrDownload } from './share'
import { today } from './projects'

// A design is a cols × rows grid. Each cell is one base-36 character: an index
// into `palette`, where index 0 means "empty". So up to 35 colors per design.

export const MAX_COLORS = 35
export const MAX_SIDE = 400
export const EMPTY_COLOR = '#FFFDF8'

export const DEFAULT_PALETTE = [
  '', // 0 = empty
  '#1F3A5F', // navy
  '#B3261E', // red
  '#2E6B3F', // green
  '#D4A62A', // gold
  '#E8A1B0', // pink
  '#8FB8DE', // light blue
  '#6B4A2B', // brown
  '#222222', // black
  '#FFFFFF', // white
]

export const SIZE_PRESETS: { label: string; cols: number; rows: number }[] = [
  { label: 'Belt', cols: 200, rows: 20 },
  { label: 'Ornament', cols: 30, rows: 30 },
  { label: 'Pillow', cols: 60, rows: 60 },
  { label: 'Sweater chart', cols: 40, rows: 50 },
]

export function blankDesign(cols: number, rows: number, name = '', projectId?: string): Design {
  const now = Date.now()
  return {
    id: newId(),
    name,
    projectId,
    cols,
    rows,
    palette: [...DEFAULT_PALETTE],
    cells: '0'.repeat(cols * rows),
    createdAt: now,
    updatedAt: now,
  }
}

export function decodeCells(d: Pick<Design, 'cells' | 'cols' | 'rows'>): Uint8Array {
  const out = new Uint8Array(d.cols * d.rows)
  for (let i = 0; i < out.length && i < d.cells.length; i++) out[i] = parseInt(d.cells[i], 36) || 0
  return out
}

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'
export function encodeCells(cells: Uint8Array): string {
  let s = ''
  // Build in chunks so huge grids don't create millions of tiny strings.
  const CHUNK = 4096
  for (let i = 0; i < cells.length; i += CHUNK) {
    let part = ''
    const end = Math.min(cells.length, i + CHUNK)
    for (let j = i; j < end; j++) part += DIGITS[cells[j]]
    s += part
  }
  return s
}

export async function createDesign(d: Design) {
  await db.designs.add(d)
}

export async function updateDesign(id: string, changes: Partial<Design>) {
  await db.designs.update(id, { ...changes, updatedAt: Date.now() })
}

export async function deleteDesign(id: string) {
  await db.designs.delete(id)
}

/**
 * Draw a whole design onto a canvas, `cell` pixels per square.
 * Grid lines (with every 10th darker, like graph paper) when `lines` is set.
 */
export function drawDesign(
  canvas: HTMLCanvasElement,
  d: Pick<Design, 'cols' | 'rows' | 'palette'>,
  cells: Uint8Array,
  cell: number,
  lines: boolean,
) {
  const w = d.cols * cell
  const h = d.rows * cell
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = EMPTY_COLOR
  ctx.fillRect(0, 0, w, h)
  for (let r = 0; r < d.rows; r++) {
    for (let c = 0; c < d.cols; c++) {
      const v = cells[r * d.cols + c]
      if (!v) continue
      ctx.fillStyle = d.palette[v] || EMPTY_COLOR
      ctx.fillRect(c * cell, r * cell, cell, cell)
    }
  }
  if (lines && cell >= 4) {
    for (const major of [false, true]) {
      ctx.strokeStyle = major ? 'rgba(60,40,40,0.55)' : 'rgba(60,40,40,0.18)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let c = 0; c <= d.cols; c++) {
        if ((c % 10 === 0) !== major) continue
        const x = Math.min(w - 0.5, c * cell + 0.5)
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
      }
      for (let r = 0; r <= d.rows; r++) {
        if ((r % 10 === 0) !== major) continue
        const y = Math.min(h - 0.5, r * cell + 0.5)
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
      }
      ctx.stroke()
    }
  }
}

/** Render the design as a PNG chart (with grid lines), about 3000px on its long side. */
export async function makePngFile(d: Design, cells: Uint8Array): Promise<File> {
  const cell = Math.max(4, Math.min(30, Math.floor(3000 / Math.max(d.cols, d.rows))))
  const canvas = document.createElement('canvas')
  drawDesign(canvas, d, cells, cell, true)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('Could not make the picture.')
  const safe = (d.name || 'design').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'design'
  return new File([blob], `${safe}-${today()}.png`, { type: 'image/png' })
}

/** Must be called straight from a tap. */
export function savePng(file: File, title: string) {
  return shareOrDownload(file, title)
}
