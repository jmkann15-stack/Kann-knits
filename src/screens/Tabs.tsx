import { Link } from 'react-router-dom'
import { XIcon } from '../components/Icons'
import { isStandalone } from '../lib/platform'
import { setSetting, useSettings } from '../lib/settings'

/** Shown in the browser (not installed) until dismissed. */
export function InstallBanner() {
  const { installBannerDismissed } = useSettings()
  if (isStandalone() || installBannerDismissed) return null
  return (
    <div className="mx-5 mt-4 flex items-center gap-2 rounded-2xl bg-rose-soft py-1 pl-4">
      <Link to="/install" className="flex min-h-12 flex-1 items-center text-lg font-semibold text-rose-dark">
        Add Kann Knits to your Home Screen →
      </Link>
      <button
        aria-label="Dismiss"
        onClick={() => setSetting('installBannerDismissed', true)}
        className="flex h-12 w-12 items-center justify-center text-rose-dark"
      >
        <XIcon size={22} />
      </button>
    </div>
  )
}
