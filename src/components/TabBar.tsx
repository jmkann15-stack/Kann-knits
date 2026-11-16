import { NavLink, useLocation } from 'react-router-dom'
import { BasketIcon, GearIcon, HeartIcon, YarnIcon } from './Icons'

const TABS = [
  { to: '/', label: 'Projects', Icon: YarnIcon, end: true },
  { to: '/gallery', label: 'Made with Love', Icon: HeartIcon, end: false },
  { to: '/stash', label: 'Stash', Icon: BasketIcon, end: false },
  { to: '/settings', label: 'Settings', Icon: GearIcon, end: false },
]

export function TabBar() {
  const { pathname } = useLocation()
  const inProject = pathname.startsWith('/projects') || pathname.startsWith('/designs')
  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur-sm select-none"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 pt-1 text-[12.5px] leading-tight font-semibold whitespace-nowrap ${
                  isActive || (to === '/' && inProject) ? 'text-rose' : 'text-ink-soft'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={27} strokeWidth={isActive || (to === '/' && inProject) ? 2.2 : 1.7} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
