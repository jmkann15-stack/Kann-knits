import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { GIFT_MESSAGE, JUST_FOR_ME } from '../config'
import { Button, Card, PageHeader, SectionLabel, ToggleRow, inputClass } from '../components/ui'
import { ChevronRight, TrashIcon, YarnBallArt } from '../components/Icons'
import { InstallGuide } from '../components/InstallGuide'
import { setSetting, useSettings } from '../lib/settings'
import { isStandalone } from '../lib/platform'
import { GiftNote } from './Onboarding'
import { timeAgo } from '../lib/backup'

function LinkRow({ to, label, detail }: { to: string; label: string; detail?: ReactNode }) {
  return (
    <Link to={to} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-oat">
      <span className="flex-1 text-lg">{label}</span>
      {detail && <span className="text-ink-soft">{detail}</span>}
      <ChevronRight size={22} className="text-ink-soft" />
    </Link>
  )
}

export function SettingsScreen() {
  const s = useSettings()
  return (
    <>
      <PageHeader title="Settings" />
      <div className="px-5 pb-8">
        <SectionLabel>Family</SectionLabel>
        <Card>
          <LinkRow to="/settings/family" label="Family list" detail={`${s.family.length} people`} />
        </Card>

        <SectionLabel>Projects</SectionLabel>
        <Card>
          <LinkRow to="/settings/types" label="Project types" detail={`${s.projectTypes.length}`} />
        </Card>

        <SectionLabel>Your data</SectionLabel>
        <Card>
          <LinkRow
            to="/settings/backup"
            label="Backup & restore"
            detail={s.lastBackupAt ? `Last: ${timeAgo(s.lastBackupAt)}` : 'Never'}
          />
        </Card>

        <SectionLabel>Reading</SectionLabel>
        <Card>
          <ToggleRow
            label="Larger text"
            hint="Makes everything in the app easier to read"
            checked={s.largerText}
            onChange={(v) => setSetting('largerText', v)}
          />
        </Card>

        {!isStandalone() && (
          <>
            <SectionLabel>App</SectionLabel>
            <Card>
              <LinkRow to="/install" label="Add to Home Screen" />
            </Card>
          </>
        )}

        <SectionLabel>About</SectionLabel>
        <Card>
          <LinkRow to="/settings/about" label="About Kann Knits" />
        </Card>
        <p className="mt-4 px-1 text-sm text-ink-soft">
          Everything you add stays on this phone.{' '}
          {s.storagePersisted === true && 'Your phone has been asked to keep it safe.'}
        </p>
      </div>
    </>
  )
}

export function FamilyScreen() {
  const { family } = useSettings()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const add = async () => {
    const n = name.trim()
    if (!n) return
    if (family.some((f) => f.toLowerCase() === n.toLowerCase()) || n.toLowerCase() === JUST_FOR_ME.toLowerCase()) {
      setError(`${n} is already on the list.`)
      return
    }
    await setSetting('family', [...family, n])
    setName('')
    setError('')
  }

  const remove = async (n: string) => {
    if (!confirm(`Remove ${n} from the family list?\n\nAnything you’ve already made for ${n} stays in your gallery.`)) return
    await setSetting('family', family.filter((f) => f !== n))
  }

  return (
    <>
      <PageHeader title="Family" subtitle="Who you make things for" back="/settings" />
      <div className="px-5 pb-8">
        <Card className="mt-5">
          {family.map((f) => (
            <div key={f} className="flex min-h-16 items-center gap-3 pl-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-soft font-serif text-lg font-semibold text-rose-dark">
                {f.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 text-lg">{f}</span>
              <button
                onClick={() => remove(f)}
                aria-label={`Remove ${f}`}
                className="flex h-14 w-14 items-center justify-center text-ink-soft active:text-rose"
              >
                <TrashIcon size={22} />
              </button>
            </div>
          ))}
          <div className="flex min-h-16 items-center gap-3 pl-4 text-ink-soft">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-heather-soft text-heather">♥</span>
            <span className="flex-1 text-lg italic">{JUST_FOR_ME}</span>
            <span className="pr-4 text-sm">always included</span>
          </div>
        </Card>

        <SectionLabel>Add someone</SectionLabel>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="flex gap-3"
        >
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            placeholder="Name"
            autoCapitalize="words"
            enterKeyHint="done"
            className="min-h-14 min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 text-lg outline-none focus:border-rose"
          />
          <Button type="submit" disabled={!name.trim()}>
            Add
          </Button>
        </form>
        {error && <p className="mt-2 px-1 text-rose-dark">{error}</p>}
      </div>
    </>
  )
}

export function ProjectTypesScreen() {
  const { projectTypes } = useSettings()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const add = async () => {
    const n = name.trim()
    if (!n) return
    if (projectTypes.some((t) => t.toLowerCase() === n.toLowerCase())) {
      setError(`${n} is already on the list.`)
      return
    }
    await setSetting('projectTypes', [...projectTypes, n])
    setName('')
    setError('')
  }

  const remove = async (t: string) => {
    if (!confirm(`Remove “${t}” from the list?\n\nProjects already marked “${t}” keep it.`)) return
    await setSetting('projectTypes', projectTypes.filter((x) => x !== t))
  }

  return (
    <>
      <PageHeader title="Project types" subtitle="Choices for a project’s Type" back="/settings" />
      <div className="px-5 pb-8">
        <Card className="mt-5">
          {projectTypes.map((t) => (
            <div key={t} className="flex min-h-16 items-center gap-3 pl-4">
              <span className="flex-1 text-lg">{t}</span>
              <button
                onClick={() => remove(t)}
                aria-label={`Remove ${t}`}
                className="flex h-14 w-14 items-center justify-center text-ink-soft active:text-rose"
              >
                <TrashIcon size={22} />
              </button>
            </div>
          ))}
        </Card>

        <SectionLabel>Add a type</SectionLabel>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="flex gap-3"
        >
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            placeholder="e.g. Mittens"
            autoCapitalize="words"
            enterKeyHint="done"
            className={inputClass}
          />
          <Button type="submit" disabled={!name.trim()}>
            Add
          </Button>
        </form>
        {error && <p className="mt-2 px-1 text-rose-dark">{error}</p>}
      </div>
    </>
  )
}

export function AboutScreen() {
  return (
    <>
      <PageHeader title="About" back="/settings" />
      <div className="flex flex-col items-center px-7 pt-8 pb-10 text-center">
        <YarnBallArt size={110} />
        <h2 className="mt-4 text-2xl font-semibold text-rose-dark">{GIFT_MESSAGE.headline}</h2>
        <div className="stitch-rule my-4 w-32" />
        <GiftNote className="text-lg leading-relaxed" />
        <p className="mt-4 font-serif text-xl text-rose-dark italic">{GIFT_MESSAGE.signoff}</p>
        <Button
          variant="secondary"
          className="mt-10"
          onClick={() => setSetting('onboarded', false)}
        >
          See the welcome again
        </Button>
        <p className="mt-8 text-sm text-ink-soft">Kann Knits · Christmas 2026</p>
      </div>
    </>
  )
}

export function InstallScreen() {
  return (
    <>
      <PageHeader title="Home Screen" back />
      <div className="px-5 pt-5 pb-8">
        <p className="mb-5 text-lg text-ink-soft">
          Add Kann Knits to your Home Screen. It gets its own icon, opens full screen, and works without Wi-Fi.
        </p>
        <InstallGuide />
      </div>
    </>
  )
}
