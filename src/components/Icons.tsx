import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 26, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const YarnIcon = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7.5" />
    <path d="M4.5 8.5c4-2 9-2 13 0M3.8 12c4.3-2 10.1-2 14.4 0M7.5 17.5c1-4.5 3.8-8.8 8.5-11.4" />
    <path d="M15.5 17c1.3 1.8 3.2 3 5.5 3" />
  </Base>
)

export const HeartIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />
  </Base>
)

export const BasketIcon = (p: P) => (
  <Base {...p}>
    <path d="M3.5 10h17l-1.6 8.2a2 2 0 0 1-2 1.6H7.1a2 2 0 0 1-2-1.6L3.5 10Z" />
    <path d="M7.5 10 10 4.5M16.5 10 14 4.5M8.5 14v2.5M12 14v2.5M15.5 14v2.5" />
  </Base>
)

export const GearIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Base>
)

export const ChevronRight = (p: P) => (
  <Base {...p}>
    <path d="m9 6 6 6-6 6" />
  </Base>
)

export const ChevronLeft = (p: P) => (
  <Base {...p}>
    <path d="m15 6-6 6 6 6" />
  </Base>
)

export const PlusIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
)

export const XIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
)

/** The iOS Safari Share icon (square with an up arrow). */
export const ShareIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
  </Base>
)

/** iOS "Add to Home Screen" icon (plus in a rounded square). */
export const AddSquareIcon = (p: P) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <path d="M12 8.5v7M8.5 12h7" />
  </Base>
)

export const DotsIcon = (p: P) => (
  <Base {...p}>
    <circle cx="5.5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1" fill="currentColor" />
  </Base>
)

export const KebabIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="5.5" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="18.5" r="1" fill="currentColor" />
  </Base>
)

export const CounterIcon = (p: P) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M9 9.5 11 8v8M14 12h4M16 10v4" />
  </Base>
)

export const TrashIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </Base>
)

/** A big decorative yarn ball with needles, matching the app icon. */
export const SearchIcon = (p: P) => (
  <Base {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </Base>
)

export const FilterIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Base>
)

export const CameraIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Base>
)

export function YarnBallArt({ size = 160 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <clipPath id="yb-ball">
          <circle cx="256" cy="282" r="132" />
        </clipPath>
      </defs>
      <g stroke="#E2CDB0" strokeWidth="16" strokeLinecap="round">
        <line x1="150" y1="430" x2="392" y2="96" />
        <line x1="362" y1="430" x2="120" y2="96" />
      </g>
      <circle cx="398" cy="88" r="20" fill="#E2CDB0" />
      <circle cx="114" cy="88" r="20" fill="#E2CDB0" />
      <circle cx="256" cy="282" r="132" fill="#C97F91" />
      <g clipPath="url(#yb-ball)" fill="none" stroke="#E7B3BF" strokeWidth="11" strokeLinecap="round">
        <path d="M110 230 Q256 150 402 230" />
        <path d="M110 270 Q256 190 402 270" />
        <path d="M110 310 Q256 230 402 310" />
        <path d="M150 400 Q200 260 330 160" />
        <path d="M200 420 Q250 290 380 190" />
        <path d="M250 430 Q300 330 410 250" />
      </g>
      <path d="M170 384 C 140 430, 92 420, 84 452" fill="none" stroke="#C97F91" strokeWidth="12" strokeLinecap="round" />
    </svg>
  )
}

export const GridIcon = (p: P) => (
  <Base {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16" />
  </Base>
)

export const UndoIcon = (p: P) => (
  <Base {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Base>
)

export const RedoIcon = (p: P) => (
  <Base {...p}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Base>
)

export const BrushIcon = (p: P) => (
  <Base {...p}>
    <path d="M14.5 4.5 19.5 9.5 11 18l-5-5 8.5-8.5Z" />
    <path d="M6 13c-2 1-2.5 3-2.5 4.5V20h2.5c1.5 0 3.5-.5 4.5-2.5" />
  </Base>
)

export const EraserIcon = (p: P) => (
  <Base {...p}>
    <path d="m7 20-3.3-3.3a1.5 1.5 0 0 1 0-2.1L13.6 4.7a1.5 1.5 0 0 1 2.1 0l4.6 4.6a1.5 1.5 0 0 1 0 2.1L11.4 20H7Z" />
    <path d="M9 10.5 15.5 17M11 20h9" />
  </Base>
)

export const HandIcon = (p: P) => (
  <Base {...p}>
    <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11M11 10.5v-6a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5" />
    <path d="M8 12V10a1.5 1.5 0 0 0-3 0v4.5a7 7 0 0 0 7 7h.5a5.5 5.5 0 0 0 4.5-4.5v-3.5" />
  </Base>
)

export const TextIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 7V5h14v2M12 5v14M9 19h6" />
  </Base>
)

export const MinusIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
)

export const FitIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
  </Base>
)

export const PaletteIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 4a8 8 0 0 0 0 16c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.5-1-2.6 0-.9.7-1.4 1.6-1.4H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7 16.7 4 12 4Z" />
    <circle cx="8" cy="11" r="1" fill="currentColor" />
    <circle cx="11" cy="7.8" r="1" fill="currentColor" />
    <circle cx="15.2" cy="8.4" r="1" fill="currentColor" />
  </Base>
)
