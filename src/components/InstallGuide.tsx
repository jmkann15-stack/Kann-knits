import { useEffect, useState, type ReactNode } from 'react'
import {
  canPromptInstall,
  detectPlatform,
  isStandalone,
  onInstallPromptChange,
  promptInstall,
} from '../lib/platform'
import { AddSquareIcon, DotsIcon, KebabIcon, ShareIcon } from './Icons'
import { Button } from './ui'

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-line bg-paper p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose font-serif text-lg font-semibold text-white">
        {n}
      </span>
      <div className="pt-1 text-lg leading-snug">{children}</div>
    </li>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex translate-y-1 items-center rounded-lg border border-line bg-oat px-1.5 py-0.5 text-rose">
      {children}
    </span>
  )
}

/** Step-by-step "Add to Home Screen" instructions for the current device. */
export function InstallGuide() {
  const platform = detectPlatform()
  const [canPrompt, setCanPrompt] = useState(canPromptInstall())
  useEffect(() => onInstallPromptChange(() => setCanPrompt(canPromptInstall())), [])

  if (isStandalone()) {
    return (
      <p className="rounded-2xl bg-rose-soft p-4 text-lg">
        You’re all set! Kann Knits is already on your Home Screen. 🎉
      </p>
    )
  }

  if (platform === 'ios-safari' || platform === 'ios-other') {
    return (
      <div className="space-y-4">
        {platform === 'ios-other' && (
          <p className="rounded-2xl bg-heather-soft p-4 text-lg">
            For the best result, open this link in <b>Safari</b>, then follow these steps.
          </p>
        )}
        <ol className="space-y-3">
          <Step n={1}>
            Tap the <b>Share</b> button <Chip><ShareIcon size={20} /></Chip> at the bottom of the screen.
            <span className="mt-1 block text-base text-ink-soft">
              Don’t see it? Tap <Chip><DotsIcon size={20} /></Chip> first, then Share.
            </span>
          </Step>
          <Step n={2}>
            Scroll down and tap <b>Add to Home Screen</b> <Chip><AddSquareIcon size={20} /></Chip>
          </Step>
          <Step n={3}>
            Tap <b>Add</b> in the top-right corner.
          </Step>
          <Step n={4}>
            Open <b>Kann Knits</b> from your Home Screen, just like any other app.
          </Step>
        </ol>
      </div>
    )
  }

  if (platform === 'android') {
    return (
      <div className="space-y-4">
        {canPrompt && (
          <Button className="w-full" onClick={() => promptInstall()}>
            Install Kann Knits
          </Button>
        )}
        <ol className="space-y-3">
          <Step n={1}>
            Tap the <b>menu</b> button <Chip><KebabIcon size={20} /></Chip> in the top-right corner of Chrome.
          </Step>
          <Step n={2}>
            Tap <b>Add to Home screen</b> (it may say <b>Install app</b>).
          </Step>
          <Step n={3}>
            Tap <b>Install</b> or <b>Add</b>.
          </Step>
          <Step n={4}>
            Open <b>Kann Knits</b> from your Home Screen.
          </Step>
        </ol>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {canPrompt && (
        <Button className="w-full" onClick={() => promptInstall()}>
          Install Kann Knits
        </Button>
      )}
      <p className="rounded-2xl border border-line bg-paper p-4 text-lg">
        Kann Knits is made for your phone. Open this same link on your iPhone in <b>Safari</b> and you’ll see
        the steps to add it to your Home Screen.
      </p>
    </div>
  )
}
