import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, XIcon } from './Icons'

/** Back that works even when the app was opened directly on a deep link. */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}

/** Page header with serif title and a stitch divider. */
export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string
  subtitle?: string
  /** true = go back in history; a string = where to go if there's no history. */
  back?: boolean | string
  action?: ReactNode
}) {
  const goBack = useGoBack(typeof back === 'string' ? back : '/')
  return (
    <header className="pt-safe sticky top-0 z-10 bg-cream/95 backdrop-blur-sm">
      <div className="flex min-h-16 items-end gap-2 px-5 pt-4 pb-1">
        {back && (
          <button
            onClick={goBack}
            className="-ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-rose active:bg-rose-soft"
            aria-label="Back"
          >
            <ChevronLeft size={28} />
          </button>
        )}
        <div className="min-w-0 flex-1 pb-1">
          <h1 className="line-clamp-2 text-[1.9rem] leading-tight font-semibold break-words">{title}</h1>
          {subtitle && <p className="text-ink-soft">{subtitle}</p>}
        </div>
        {/* Negative top margin: a 48px button mustn't make this header taller than the others. */}
        {action && <div className="-mt-4 shrink-0">{action}</div>}
      </div>
      <div className="stitch-rule mx-5" />
    </header>
  )
}

/** Warm, helpful empty state. */
export function EmptyState({ art, title, children }: { art: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 pt-14 text-center">
      <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-rose-soft text-rose">{art}</div>
      <h2 className="mb-2 text-2xl font-semibold">{title}</h2>
      <div className="max-w-xs text-lg leading-relaxed text-ink-soft">{children}</div>
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }

export function Button({ variant = 'primary', className = '', ...rest }: BtnProps) {
  const styles = {
    primary: 'bg-rose text-white active:bg-rose-dark shadow-sm',
    secondary: 'bg-paper text-ink border border-line active:bg-oat',
    ghost: 'text-rose active:bg-rose-soft',
  }[variant]
  return (
    <button
      className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-6 text-lg font-semibold transition-colors disabled:opacity-50 ${styles} ${className}`}
      {...rest}
    />
  )
}

/** Accessible on/off switch with a full-row tap target. */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left active:bg-oat"
    >
      <span className="flex-1">
        <span className="block text-lg">{label}</span>
        {hint && <span className="block text-sm text-ink-soft">{hint}</span>}
      </span>
      <span
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-rose' : 'bg-line'}`}
      >
        <span
          className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : ''}`}
        />
      </span>
    </button>
  )
}

/** A rounded white card that groups rows, iOS-settings style. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-paper divide-y divide-line ${className}`}>
      {children}
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mt-7 mb-2 px-1 font-sans text-sm font-bold tracking-wider text-heather uppercase">{children}</h2>
}

// ── Form pieces ───────────────────────────────────────────────

export const inputClass =
  'block min-h-14 w-full min-w-0 rounded-2xl border border-line bg-paper px-4 text-lg text-ink outline-none placeholder:text-ink-soft/60 focus:border-rose'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block px-1 font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block px-1 text-sm text-ink-soft">{hint}</span>}
    </label>
  )
}

/**
 * A date box that stays inside its column on iPhone (Safari gives date inputs a
 * wide built-in minimum) and says "Tap to pick" instead of showing nothing.
 */
export function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative min-w-0">
      <input
        type="date"
        className={`${inputClass} date-input appearance-none ${value ? '' : 'text-transparent'}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {!value && (
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-ink-soft/60">
          Tap to pick
        </span>
      )}
    </div>
  )
}

/** Pill-shaped choice buttons (one selected). */
export function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`min-h-12 rounded-full border px-5 text-base font-semibold transition-colors ${
            value === o.value ? 'border-rose bg-rose text-white' : 'border-line bg-paper text-ink active:bg-oat'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Bottom sheet modal. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="animate-rise pb-safe relative max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-cream shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-cream px-5 pt-4 pb-2">
          <h2 className="flex-1 text-2xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-12 w-12 items-center justify-center rounded-full text-ink-soft active:bg-oat"
          >
            <XIcon size={24} />
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}

/** Thin progress bar. `value` is 0–1. */
export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      className={`h-2.5 overflow-hidden rounded-full bg-oat ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-rose transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** A titled card of label/value rows for detail screens. */
export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-3xl border border-line bg-paper p-4">
      <h2 className="mb-2 text-lg font-semibold text-rose-dark">{title}</h2>
      <dl className="space-y-2">{children}</dl>
    </section>
  )
}

/** One label/value row; hides itself when empty. */
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null
  return (
    <div className="flex gap-3 text-lg">
      <dt className="w-28 shrink-0 text-ink-soft">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  )
}

/** Cancel/Save bar pinned above the tab bar on form screens. */
export function SaveBar({
  onCancel,
  saving,
  label,
}: {
  onCancel: () => void
  saving: boolean
  label: string
}) {
  return (
    <div
      className="fixed inset-x-0 z-20 border-t border-line bg-cream/95 px-5 py-3 backdrop-blur-sm"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-xl gap-3">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-[2]" disabled={saving}>
          {saving ? 'Saving…' : label}
        </Button>
      </div>
    </div>
  )
}
