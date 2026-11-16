import { useEffect, useState } from 'react'

// ── Haptics ───────────────────────────────────────────────────
// Android: navigator.vibrate. iOS Safari has no vibrate API, but since iOS 18
// toggling a native <input type="checkbox" switch> gives a light system tap.

let iosSwitch: HTMLLabelElement | null = null

function getIosSwitch() {
  if (iosSwitch) return iosSwitch
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-10px'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.appendChild(input)
  document.body.appendChild(label)
  iosSwitch = label
  return label
}

export function haptic(ms = 12) {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
      return
    }
    getIosSwitch().click()
  } catch {
    /* haptics are a nice-to-have */
  }
}

// ── Screen Wake Lock ──────────────────────────────────────────

export type WakeState = 'active' | 'unsupported' | 'off'

/** Keeps the screen on while mounted. Re-acquires after the app returns to the foreground. */
export function useWakeLock(): WakeState {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [state, setState] = useState<WakeState>(supported ? 'off' : 'unsupported')

  useEffect(() => {
    if (!supported) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || cancelled) return
      try {
        sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          sentinel.release()
          return
        }
        setState('active')
        sentinel.addEventListener('release', () => !cancelled && setState('off'))
      } catch {
        setState('off')
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      sentinel?.release().catch(() => {})
    }
  }, [supported])

  return state
}

// ── Blob → object URL ─────────────────────────────────────────

export function useObjectUrl(blob?: Blob | null): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
