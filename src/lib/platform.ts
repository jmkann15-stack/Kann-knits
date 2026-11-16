// Platform + install detection, and capture of Android's install prompt.

export type Platform = 'ios-safari' | 'ios-other' | 'android' | 'desktop'

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari's own flag
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const isIOS = /iPhone|iPad|iPod/.test(ua) || iPadOS
  if (isIOS) {
    // Chrome, Firefox, Edge etc. on iOS identify themselves with these tokens.
    return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? 'ios-other' : 'ios-safari'
  }
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

// ── Android / Chrome "Install app" prompt ────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((l) => l())
  })
}

export const canPromptInstall = () => deferredPrompt !== null

export function onInstallPromptChange(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  listeners.forEach((l) => l())
  return outcome === 'accepted'
}
