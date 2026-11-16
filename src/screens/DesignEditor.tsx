import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Design } from '../db'
import {
  EMPTY_COLOR,
  MAX_COLORS,
  decodeCells,
  deleteDesign,
  encodeCells,
  makePngFile,
  savePng,
  updateDesign,
} from '../lib/designs'
import { FONT_HEIGHT, supported, textBitmap } from '../lib/blockFont'
import { haptic } from '../lib/device'
import { Button, Choice, Field, Sheet, inputClass, useGoBack } from '../components/ui'
import {
  BrushIcon,
  ChevronLeft,
  DotsIcon,
  EraserIcon,
  FitIcon,
  HandIcon,
  MinusIcon,
  PaletteIcon,
  PlusIcon,
  RedoIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
} from '../components/Icons'

type Tool = 'paint' | 'erase' | 'move' | 'stamp'
type Bitmap = ReturnType<typeof textBitmap>
interface View {
  s: number // pixels per square
  tx: number // where the grid's left edge is, in canvas pixels
  ty: number
}

const MARGIN = 16
const MAX_SCALE = 64
const UNDO_LIMIT = 60

export function DesignEditorScreen() {
  const { id = '' } = useParams()
  const q = useLiveQuery(async () => ({ d: await db.designs.get(id) }), [id])
  if (!q) return <div className="h-dvh bg-cream" />
  if (!q.d) return <Navigate to="/designs" replace />
  return <Editor key={q.d.id} initial={q.d} />
}

function Editor({ initial }: { initial: Design }) {
  const navigate = useNavigate()
  const goBack = useGoBack('/designs')
  const { id, cols, rows } = initial

  // ── Design data (cells live in a ref for speed; the rest in state) ──
  const cells = useRef(decodeCells(initial))
  const [name, setName] = useState(initial.name)
  const [palette, setPalette] = useState(initial.palette)
  const [projectId, setProjectId] = useState(initial.projectId ?? '')
  const paletteRef = useRef(palette)
  paletteRef.current = palette

  const [tool, setTool] = useState<Tool>('paint')
  const [color, setColor] = useState(1)
  const toolRef = useRef(tool)
  toolRef.current = tool
  const colorRef = useRef(color)
  colorRef.current = color

  // ── Undo / redo ──
  const undoStack = useRef<Uint8Array[]>([])
  const redoStack = useRef<Uint8Array[]>([])
  const [, setHistoryTick] = useState(0)
  const bumpHistory = () => setHistoryTick((n) => n + 1)
  const pushUndo = () => {
    undoStack.current.push(cells.current.slice())
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift()
    redoStack.current = []
    bumpHistory()
  }

  // ── Saving: soon after each change, and right away when the app is hidden ──
  const dirty = useRef(false)
  const saveTimer = useRef<number | undefined>(undefined)
  const persist = useCallback(() => {
    window.clearTimeout(saveTimer.current)
    if (!dirty.current) return
    dirty.current = false
    updateDesign(id, { cells: encodeCells(cells.current) }).catch(() => {
      dirty.current = true
    })
  }, [id])
  const markDirty = useCallback(() => {
    dirty.current = true
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(persist, 500)
  }, [persist])
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && persist()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', persist)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', persist)
      persist()
    }
  }, [persist])

  // ── Canvas, view and drawing ──
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = useRef({ w: 0, h: 0 })
  const view = useRef<View>({ s: 16, tx: MARGIN, ty: MARGIN })
  const viewReady = useRef(false)
  const stampAt = useRef<{ r: number; c: number } | null>(null)
  const stampBitmap = useRef<Bitmap | null>(null)
  const frame = useRef(0)
  const [where, setWhere] = useState<{ r: number; c: number } | null>(null)

  const fitScale = () => {
    const { w, h } = size.current
    return Math.max(0.5, Math.min((w - 2 * MARGIN) / cols, (h - 2 * MARGIN) / rows))
  }

  /** Keep the grid on screen: centered when it fits, otherwise no further than the margins. */
  const clampView = (v: View): View => {
    const { w, h } = size.current
    const s = Math.min(MAX_SCALE, Math.max(fitScale(), v.s))
    const dw = cols * s
    const dh = rows * s
    const tx = dw + 2 * MARGIN <= w ? (w - dw) / 2 : Math.min(MARGIN, Math.max(w - MARGIN - dw, v.tx))
    const ty = dh + 2 * MARGIN <= h ? (h - dh) / 2 : Math.min(MARGIN, Math.max(h - MARGIN - dh, v.ty))
    return { s, tx, ty }
  }

  const draw = useCallback(() => {
    frame.current = 0
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const { w, h } = size.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#EFE7DA'
    ctx.fillRect(0, 0, w, h)

    const { s, tx, ty } = view.current
    const pal = paletteRef.current
    const c0 = Math.max(0, Math.floor(-tx / s))
    const c1 = Math.min(cols, Math.ceil((w - tx) / s))
    const r0 = Math.max(0, Math.floor(-ty / s))
    const r1 = Math.min(rows, Math.ceil((h - ty) / s))
    const X = (c: number) => Math.round(tx + c * s)
    const Y = (r: number) => Math.round(ty + r * s)

    ctx.fillStyle = EMPTY_COLOR
    ctx.fillRect(X(c0), Y(r0), X(c1) - X(c0), Y(r1) - Y(r0))
    const data = cells.current
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const v = data[r * cols + c]
        if (!v) continue
        ctx.fillStyle = pal[v] || EMPTY_COLOR
        ctx.fillRect(X(c), Y(r), X(c + 1) - X(c), Y(r + 1) - Y(r))
      }
    }

    // Ghost preview of the text being placed.
    const bm = stampBitmap.current
    const at = stampAt.current
    if (bm && at) {
      ctx.globalAlpha = 0.55
      ctx.fillStyle = pal[colorRef.current] || '#000'
      for (let r = 0; r < bm.height; r++)
        for (let c = 0; c < bm.width; c++) {
          if (!bm.on[r][c]) continue
          const rr = at.r + r
          const cc = at.c + c
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue
          ctx.fillRect(X(cc), Y(rr), X(cc + 1) - X(cc), Y(rr + 1) - Y(rr))
        }
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#A8466A'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(X(at.c), Y(at.r), X(at.c + bm.width) - X(at.c), Y(at.r + bm.height) - Y(at.r))
      ctx.setLineDash([])
    }

    // Graph-paper lines; every 10th is darker so stitches are easy to count.
    if (s >= 5) {
      for (const major of [false, true]) {
        ctx.strokeStyle = major ? 'rgba(60,40,40,0.5)' : `rgba(60,40,40,${s >= 12 ? 0.2 : 0.12})`
        ctx.lineWidth = major ? 1.25 : 1
        ctx.beginPath()
        for (let c = c0; c <= c1; c++) {
          if ((c % 10 === 0) !== major) continue
          ctx.moveTo(X(c) + 0.5, Y(r0))
          ctx.lineTo(X(c) + 0.5, Y(r1))
        }
        for (let r = r0; r <= r1; r++) {
          if ((r % 10 === 0) !== major) continue
          ctx.moveTo(X(c0), Y(r) + 0.5)
          ctx.lineTo(X(c1), Y(r) + 0.5)
        }
        ctx.stroke()
      }
    }
    ctx.strokeStyle = 'rgba(60,40,40,0.7)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(X(0), Y(0), X(cols) - X(0), Y(rows) - Y(0))
  }, [cols, rows])

  const requestDraw = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw)
  }, [draw])

  useEffect(() => {
    requestDraw()
  }, [palette, requestDraw])

  // Size the canvas to its box (and the first time, choose a comfortable zoom).
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      if (!w || !h) return
      const dpr = window.devicePixelRatio || 1
      size.current = { w, h }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      if (!viewReady.current) {
        viewReady.current = true
        const fit = fitScale()
        const colsFit = (w - 2 * MARGIN) / cols
        const rowsFit = (h - 2 * MARGIN) / rows
        // Small designs fit the screen; big ones start at a size you can tap.
        const s = fit >= 10 ? Math.min(fit, 40) : Math.min(22, Math.max(10, colsFit, rowsFit))
        view.current = clampView({ s, tx: MARGIN, ty: MARGIN })
      } else {
        view.current = clampView(view.current)
      }
      draw()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw])

  const zoomAround = (factor: number, px: number, py: number) => {
    const v = view.current
    const s = Math.min(MAX_SCALE, Math.max(fitScale(), v.s * factor))
    const k = s / v.s
    view.current = clampView({ s, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k })
    requestDraw()
  }
  const zoomButton = (factor: number) => zoomAround(factor, size.current.w / 2, size.current.h / 2)
  const fit = () => {
    view.current = clampView({ s: fitScale(), tx: 0, ty: 0 })
    requestDraw()
  }

  // Mouse wheel / trackpad zoom (desktop).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      zoomAround(Math.exp(-e.deltaY * 0.0025), e.clientX - rect.left, e.clientY - rect.top)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Painting ──
  const cellAt = (x: number, y: number) => {
    const { s, tx, ty } = view.current
    return { c: Math.floor((x - tx) / s), r: Math.floor((y - ty) / s) }
  }
  const inGrid = (r: number, c: number) => r >= 0 && c >= 0 && r < rows && c < cols

  const setCell = (r: number, c: number, v: number) => {
    if (!inGrid(r, c)) return false
    const i = r * cols + c
    if (cells.current[i] === v) return false
    cells.current[i] = v
    return true
  }

  const applyStamp = (bm: Bitmap, r0: number, c0: number) => {
    pushUndo()
    let changed = false
    for (let r = 0; r < bm.height; r++)
      for (let c = 0; c < bm.width; c++) if (bm.on[r][c]) changed = setCell(r0 + r, c0 + c, colorRef.current) || changed
    if (changed) markDirty()
    else {
      undoStack.current.pop()
      bumpHistory()
    }
    haptic(15)
    requestDraw()
  }

  // Pointer state for strokes, panning and pinching.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const stroke = useRef<{ last: { r: number; c: number }; changed: boolean } | null>(null)
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; v: View } | null>(null)
  const waitAllUp = useRef(false)

  const local = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const paintLine = (a: { r: number; c: number }, b: { r: number; c: number }) => {
    const v = toolRef.current === 'erase' ? 0 : colorRef.current
    let changed = false
    const n = Math.max(Math.abs(b.r - a.r), Math.abs(b.c - a.c))
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0
      changed = setCell(Math.round(a.r + (b.r - a.r) * t), Math.round(a.c + (b.c - a.c) * t), v) || changed
    }
    return changed
  }

  const cancelStroke = () => {
    if (!stroke.current) return
    const snap = undoStack.current.pop()
    if (snap) cells.current.set(snap)
    stroke.current = null
    bumpHistory()
    requestDraw()
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* not essential: moves still arrive while the finger stays on the grid */
    }
    const p = local(e)
    pointers.current.set(e.pointerId, p)

    if (pointers.current.size === 2) {
      // Two fingers: pinch to zoom and pan. Undo anything the first finger just painted.
      cancelStroke()
      pan.current = null
      const [a, b] = [...pointers.current.values()]
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        v: { ...view.current },
      }
      return
    }
    if (pointers.current.size > 2 || waitAllUp.current) return

    const t = toolRef.current
    if (t === 'move') {
      pan.current = { x: p.x, y: p.y, tx: view.current.tx, ty: view.current.ty }
    } else if (t === 'stamp') {
      const bm = stampBitmap.current
      const cell = cellAt(p.x, p.y)
      stampAt.current = bm ? cell : null
      requestDraw()
    } else {
      const cell = cellAt(p.x, p.y)
      pushUndo()
      stroke.current = { last: cell, changed: paintLine(cell, cell) }
      if (inGrid(cell.r, cell.c)) setWhere(cell)
      requestDraw()
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const st = pinch.current
      const s = Math.min(MAX_SCALE, Math.max(fitScale(), (st.v.s * dist) / st.dist))
      // Keep the point that was under the fingers under the fingers.
      const gx = (st.mid.x - st.v.tx) / st.v.s
      const gy = (st.mid.y - st.v.ty) / st.v.s
      view.current = clampView({ s, tx: mid.x - gx * s, ty: mid.y - gy * s })
      requestDraw()
      return
    }
    if (pan.current) {
      const st = pan.current
      view.current = clampView({ s: view.current.s, tx: st.tx + p.x - st.x, ty: st.ty + p.y - st.y })
      requestDraw()
      return
    }
    if (toolRef.current === 'stamp' && stampAt.current) {
      const cell = cellAt(p.x, p.y)
      if (cell.r !== stampAt.current.r || cell.c !== stampAt.current.c) {
        stampAt.current = cell
        requestDraw()
      }
      return
    }
    if (stroke.current) {
      const cell = cellAt(p.x, p.y)
      const last = stroke.current.last
      if (cell.r === last.r && cell.c === last.c) return
      if (paintLine(last, cell)) stroke.current.changed = true
      stroke.current.last = cell
      if (inGrid(cell.r, cell.c)) setWhere(cell)
      requestDraw()
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    const cancelled = e.type === 'pointercancel'

    if (pinch.current) {
      if (pointers.current.size < 2) {
        pinch.current = null
        // Don't let the finger that's still down start painting.
        waitAllUp.current = pointers.current.size > 0
      }
      return
    }
    if (pointers.current.size === 0) waitAllUp.current = false
    pan.current = null

    if (toolRef.current === 'stamp' && stampAt.current && stampBitmap.current) {
      const at = stampAt.current
      stampAt.current = null
      if (!cancelled) {
        applyStamp(stampBitmap.current, at.r, at.c)
        stampBitmap.current = null
        setTool('paint')
      }
      requestDraw()
      return
    }
    if (stroke.current) {
      if (cancelled) cancelStroke()
      else if (stroke.current.changed) markDirty()
      else {
        undoStack.current.pop()
        bumpHistory()
      }
      stroke.current = null
    }
  }

  const undo = () => {
    const snap = undoStack.current.pop()
    if (!snap) return
    redoStack.current.push(cells.current.slice())
    cells.current.set(snap)
    markDirty()
    bumpHistory()
    requestDraw()
  }
  const redo = () => {
    const snap = redoStack.current.pop()
    if (!snap) return
    undoStack.current.push(cells.current.slice())
    cells.current.set(snap)
    markDirty()
    bumpHistory()
    requestDraw()
  }

  // ── Sheets ──
  const [sheet, setSheet] = useState<'none' | 'more' | 'colors' | 'text' | 'delete'>('none')
  const [text, setText] = useState('')
  const [textScale, setTextScale] = useState<'1' | '2'>(rows >= 2 * FONT_HEIGHT + 2 ? '2' : '1')
  const [png, setPng] = useState<{ state: 'idle' | 'making' | 'ready' | 'saved'; file?: File }>({ state: 'idle' })

  const savePalette = (next: string[]) => {
    setPalette(next)
    updateDesign(id, { palette: next })
  }

  const removeColor = (idx: number) => {
    const used = cells.current.some((v) => v === idx)
    if (used && !confirm('Squares in this color will be cleared. Remove it?')) return
    if (used) pushUndo()
    const data = cells.current
    for (let i = 0; i < data.length; i++) {
      if (data[i] === idx) data[i] = 0
      else if (data[i] > idx) data[i] -= 1
    }
    // Undo snapshots use the old color numbers, so they can't be replayed safely.
    if (used) {
      undoStack.current = []
      redoStack.current = []
      bumpHistory()
    }
    const next = palette.filter((_, i) => i !== idx)
    savePalette(next)
    persistNow()
    if (color >= next.length) setColor(next.length - 1)
    else if (color > idx) setColor(color - 1)
    requestDraw()
  }
  const persistNow = () => {
    dirty.current = true
    persist()
  }

  const textChars = [...text].filter((ch) => supported(ch)).join('')
  const skipped = [...new Set([...text].filter((ch) => !supported(ch)))].join(' ')
  const bitmap = textChars.trim() ? textBitmap(textChars, textScale === '2' ? 2 : 1) : null

  const place = () => {
    if (!bitmap) return
    stampBitmap.current = bitmap
    setTool('stamp')
    setSheet('none')
  }
  const center = () => {
    if (!bitmap) return
    applyStamp(bitmap, Math.floor((rows - bitmap.height) / 2), Math.floor((cols - bitmap.width) / 2))
    setSheet('none')
  }

  const projects = useLiveQuery(() => db.projects.toArray(), [])
  const projectOptions = (projects ?? [])
    .filter((p) => p.status !== 'finished' || p.id === projectId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const toolBtn = (t: Tool, label: string, icon: ReactNode) => (
    <button
      key={t}
      onClick={() => {
        if (t !== 'stamp') stampBitmap.current = null
        setTool(t)
        requestDraw()
      }}
      aria-pressed={tool === t}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[13px] font-semibold ${
        tool === t ? 'bg-rose text-white' : 'text-ink active:bg-oat'
      }`}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="flex h-dvh flex-col bg-cream select-none">
      {/* Top bar */}
      <header className="pt-safe border-b border-line bg-cream">
        <div className="flex min-h-16 items-center gap-1 px-2">
          <button
            onClick={() => {
              persist()
              goBack()
            }}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-rose active:bg-rose-soft"
            aria-label="Back"
          >
            <ChevronLeft size={28} />
          </button>
          <button onClick={() => setSheet('more')} className="min-w-0 flex-1 text-left">
            <span className="block truncate font-serif text-xl font-semibold">{name || 'Untitled design'}</span>
            <span className="block truncate text-sm text-ink-soft">
              {cols} × {rows}
              {where && ` · row ${where.r + 1}, sq ${where.c + 1}`}
            </span>
          </button>
          <button
            onClick={undo}
            disabled={!undoStack.current.length}
            aria-label="Undo"
            className="flex h-12 w-12 items-center justify-center rounded-full text-ink active:bg-oat disabled:opacity-30"
          >
            <UndoIcon size={24} />
          </button>
          <button
            onClick={redo}
            disabled={!redoStack.current.length}
            aria-label="Redo"
            className="flex h-12 w-12 items-center justify-center rounded-full text-ink active:bg-oat disabled:opacity-30"
          >
            <RedoIcon size={24} />
          </button>
          <button
            onClick={() => setSheet('more')}
            aria-label="More"
            className="flex h-12 w-12 items-center justify-center rounded-full text-ink active:bg-oat"
          >
            <DotsIcon size={26} />
          </button>
        </div>
      </header>

      {/* Canvas */}
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Design grid"
        />
        {tool === 'stamp' && (
          <div className="absolute inset-x-3 top-3 flex items-center gap-2 rounded-2xl bg-ink/85 py-1 pr-1 pl-4 text-white shadow-lg">
            <span className="flex-1 leading-snug">Tap where the text should start (its top-left corner).</span>
            <button
              onClick={() => {
                stampBitmap.current = null
                stampAt.current = null
                setTool('paint')
                requestDraw()
              }}
              className="min-h-12 rounded-xl px-3 font-semibold"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-2xl border border-line bg-paper/95 shadow-sm">
          <button onClick={() => zoomButton(1.5)} aria-label="Zoom in" className="flex h-12 w-12 items-center justify-center active:bg-oat">
            <PlusIcon size={24} />
          </button>
          <button onClick={() => zoomButton(1 / 1.5)} aria-label="Zoom out" className="flex h-12 w-12 items-center justify-center border-y border-line active:bg-oat">
            <MinusIcon size={24} />
          </button>
          <button onClick={fit} aria-label="Show the whole design" className="flex h-12 w-12 items-center justify-center active:bg-oat">
            <FitIcon size={22} />
          </button>
        </div>
      </div>

      {/* Tools and colors */}
      <div className="pb-safe border-t border-line bg-paper">
        <div className="flex gap-1 px-2 pt-2">
          {toolBtn('paint', 'Paint', <BrushIcon size={22} />)}
          {toolBtn('erase', 'Erase', <EraserIcon size={22} />)}
          {toolBtn('move', 'Move', <HandIcon size={22} />)}
          <button
            onClick={() => setSheet('text')}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[13px] font-semibold ${
              tool === 'stamp' ? 'bg-rose text-white' : 'text-ink active:bg-oat'
            }`}
          >
            <TextIcon size={22} />
            Text
          </button>
        </div>
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 py-2.5">
          {palette.map((hex, i) =>
            i === 0 ? null : (
              <button
                key={i}
                onClick={() => {
                  setColor(i)
                  if (tool === 'erase' || tool === 'move') setTool('paint')
                }}
                aria-label={`Color ${i}`}
                aria-pressed={color === i}
                className={`h-12 w-12 shrink-0 rounded-full border-2 ${
                  color === i && tool !== 'erase' ? 'border-ink ring-2 ring-rose ring-offset-2 ring-offset-paper' : 'border-line'
                }`}
                style={{ background: hex }}
              />
            ),
          )}
          <button
            onClick={() => setSheet('colors')}
            aria-label="Edit colors"
            className="flex h-12 shrink-0 items-center gap-1.5 rounded-full border border-line px-4 font-semibold text-ink active:bg-oat"
          >
            <PaletteIcon size={22} />
            Colors
          </button>
        </div>
      </div>

      {/* Text helper */}
      <Sheet open={sheet === 'text'} title="Add text" onClose={() => setSheet('none')}>
        <div className="space-y-4">
          <Field label="Letters" hint="A–Z, numbers, and . , ! ? ' - + / & ♥">
            <input
              className={`${inputClass} uppercase`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. JMK"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </Field>
          {skipped && <p className="text-rose-dark">These can’t be drawn and will be skipped: {skipped}</p>}
          <Field label="Size">
            <Choice
              options={[
                { value: '1', label: `Regular (${FONT_HEIGHT} tall)` },
                { value: '2', label: `Big (${FONT_HEIGHT * 2} tall)` },
              ]}
              value={textScale}
              onChange={setTextScale}
            />
          </Field>
          {bitmap && (
            <div>
              <p className="mb-1.5 px-1 font-semibold">
                Preview <span className="font-normal text-ink-soft">({bitmap.width} squares wide, in your current color)</span>
              </p>
              <div className="overflow-x-auto rounded-2xl border border-line bg-[#FFFDF8] p-3">
                <div
                  className="grid gap-px"
                  style={{ gridTemplateColumns: `repeat(${bitmap.width}, 8px)`, width: bitmap.width * 9 }}
                >
                  {bitmap.on.flatMap((row, r) =>
                    row.map((on, c) => (
                      <span
                        key={`${r}-${c}`}
                        className="h-2 w-2"
                        style={{ background: on ? palette[color] || '#222' : 'transparent' }}
                      />
                    )),
                  )}
                </div>
              </div>
              {(bitmap.width > cols || bitmap.height > rows) && (
                <p className="mt-2 text-rose-dark">
                  That’s bigger than your design ({cols} × {rows}), so part of it will be cut off.
                </p>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={center} disabled={!bitmap}>
              Put in middle
            </Button>
            <Button className="flex-1" onClick={place} disabled={!bitmap}>
              Choose spot
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Colors */}
      <Sheet open={sheet === 'colors'} title="Colors" onClose={() => setSheet('none')}>
        <p className="mb-3 text-ink-soft">Tap a color to change it.</p>
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {palette.map((hex, i) =>
            i === 0 ? null : (
              <div key={i} className="flex min-h-16 items-center gap-3 px-3">
                <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-line" style={{ background: hex }}>
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) => {
                      const next = [...palette]
                      next[i] = e.target.value.toUpperCase()
                      savePalette(next)
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label={`Change color ${i}`}
                  />
                </label>
                <button
                  className="min-h-12 flex-1 text-left text-lg"
                  onClick={() => {
                    setColor(i)
                    setTool('paint')
                    setSheet('none')
                  }}
                >
                  {color === i ? 'Painting with this' : 'Use this color'}
                </button>
                {palette.length > 2 && (
                  <button
                    onClick={() => removeColor(i)}
                    aria-label={`Remove color ${i}`}
                    className="flex h-12 w-12 items-center justify-center text-ink-soft active:text-rose"
                  >
                    <TrashIcon size={22} />
                  </button>
                )}
              </div>
            ),
          )}
        </div>
        {palette.length - 1 < MAX_COLORS && (
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => {
              const next = [...palette, '#9C8C84']
              savePalette(next)
              setColor(next.length - 1)
            }}
          >
            Add a color
          </Button>
        )}
      </Sheet>

      {/* More */}
      <Sheet
        open={sheet === 'more'}
        title="Design"
        onClose={() => {
          setSheet('none')
          setPng({ state: 'idle' })
        }}
      >
        <div className="space-y-4">
          <Field label="Name">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                updateDesign(id, { name: e.target.value })
              }}
              placeholder="Untitled design"
              autoComplete="off"
            />
          </Field>
          <Field label="For a project">
            <select
              className={inputClass}
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value)
                updateDesign(id, { projectId: e.target.value || undefined })
              }}
            >
              <option value="">Not attached</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          {projectId && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                persist()
                navigate(`/projects/${projectId}`)
              }}
            >
              Open the project
            </Button>
          )}

          <div className="rounded-2xl border border-line bg-paper p-4">
            <p className="mb-3 text-lg font-semibold">Save as a picture</p>
            {png.state === 'ready' && png.file ? (
              <Button
                className="w-full"
                onClick={async () => {
                  if (await savePng(png.file!, name || 'Design')) setPng({ state: 'saved' })
                }}
              >
                Save picture
              </Button>
            ) : png.state === 'saved' ? (
              <p className="text-lg font-semibold text-sage">Saved ✓</p>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                disabled={png.state === 'making'}
                onClick={async () => {
                  persist()
                  setPng({ state: 'making' })
                  const file = await makePngFile({ ...initial, name, palette }, cells.current)
                  setPng({ state: 'ready', file })
                }}
              >
                {png.state === 'making' ? 'Making the picture…' : 'Make a picture (PNG)'}
              </Button>
            )}
            <p className="mt-2 text-sm text-ink-soft">
              A chart with grid lines. On iPhone, choose <b>Save Image</b> to put it in Photos, or print it.
            </p>
          </div>

          <Button variant="ghost" className="w-full text-ink-soft" onClick={() => setSheet('delete')}>
            Delete design
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'delete'} title="Delete this design?" onClose={() => setSheet('none')}>
        <p className="text-lg leading-relaxed text-ink-soft">
          “{name || 'Untitled design'}” will be deleted. This can’t be undone.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setSheet('none')}>
            Keep it
          </Button>
          <Button
            className="flex-1"
            onClick={async () => {
              dirty.current = false
              await deleteDesign(id)
              navigate('/designs', { replace: true })
            }}
          >
            Delete
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
