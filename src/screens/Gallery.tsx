import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Project } from '../db'
import { JUST_FOR_ME } from '../config'
import { formatDate } from '../lib/projects'
import { useSettings } from '../lib/settings'
import { EmptyState, PageHeader } from '../components/ui'
import { FileImage } from '../components/FileImage'
import { HeartIcon, YarnBallArt } from '../components/Icons'
import { useCoverId } from './Projects'

const ALL = ''

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

function forLabel(name: string) {
  return name === JUST_FOR_ME ? 'just for you' : `for ${name}`
}

function GalleryTile({ p, showFor }: { p: Project; showFor: boolean }) {
  const coverId = useCoverId(p)
  return (
    <Link to={`/projects/${p.id}`} className="block overflow-hidden rounded-3xl border border-line bg-paper active:bg-oat">
      <div className="aspect-square w-full bg-rose-soft">
        {coverId ? (
          <FileImage fileId={coverId} className="h-full w-full" alt={p.name} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <YarnBallArt size={80} />
          </div>
        )}
      </div>
      <div className="p-3">
        <h2 className="line-clamp-2 text-lg leading-tight font-semibold break-words">{p.name || 'Untitled'}</h2>
        {showFor && p.madeFor && (
          <p className="truncate text-ink-soft">{p.madeFor === JUST_FOR_ME ? 'Just for me' : `For ${p.madeFor}`}</p>
        )}
        {p.finishDate && <p className="text-sm text-ink-soft">{formatDate(p.finishDate)}</p>}
      </div>
    </Link>
  )
}

export function GalleryScreen() {
  const { family } = useSettings()
  const [params, setParams] = useSearchParams()
  const person = params.get('for') ?? ALL
  const chipsRef = useRef<HTMLDivElement>(null)

  const finished = useLiveQuery(() => db.projects.where('status').equals('finished').toArray(), [])
  const all = (finished ?? []).sort(
    (a, b) => (b.finishDate ?? '').localeCompare(a.finishDate ?? '') || b.updatedAt - a.updatedAt,
  )

  // Count per person, then build the chips: the family first, then "Just for me",
  // then anyone else she's made things for (e.g. a name removed from the list).
  const counts = new Map<string, number>()
  for (const p of all) if (p.madeFor) counts.set(p.madeFor, (counts.get(p.madeFor) ?? 0) + 1)
  const people = [...family, JUST_FOR_ME]
  for (const name of counts.keys()) if (!people.includes(name)) people.push(name)

  const shown = person === ALL ? all : all.filter((p) => p.madeFor === person)
  const years = shown.map((p) => p.finishDate?.slice(0, 4)).filter(Boolean) as string[]
  const since = years.length ? years.reduce((a, b) => (a < b ? a : b)) : ''

  let stats = ''
  if (person === ALL && all.length) {
    const [top, topN] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
    stats = [
      `${plural(all.length, 'piece')} made`,
      top && topN && topN > 1 && `${topN} ${forLabel(top)}`,
      since && `since ${since}`,
    ]
      .filter(Boolean)
      .join(' · ')
  } else if (person !== ALL && shown.length) {
    stats = [`${plural(shown.length, 'piece')} ${forLabel(person)}`, since && `since ${since}`]
      .filter(Boolean)
      .join(' · ')
  }

  // Keep the chosen person's chip in view (e.g. coming back to "Just for me").
  const ready = !!finished
  useEffect(() => {
    chipsRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [person, ready])

  if (finished && all.length === 0) {
    return (
      <>
        <PageHeader title="Made with Love" />
        <EmptyState art={<HeartIcon size={56} strokeWidth={1.4} />} title="Your keepsake gallery">
          When you mark a project <b>Finished</b>, it shows up here, along with who you made it for.
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Made with Love" subtitle={stats || undefined} />

      <div
        ref={chipsRef}
        className="no-scrollbar flex scroll-px-5 gap-2 overflow-x-auto px-5 pt-4 pb-1"
        role="tablist"
        aria-label="Made for"
      >
        {[ALL, ...people].map((name) => {
          const on = person === name
          const n = name === ALL ? all.length : (counts.get(name) ?? 0)
          return (
            <button
              key={name || 'all'}
              role="tab"
              aria-selected={on}
              onClick={() => setParams(name === ALL ? {} : { for: name }, { replace: true })}
              className={`min-h-12 shrink-0 rounded-full border px-4 text-[15px] font-semibold whitespace-nowrap transition-colors ${
                on ? 'border-rose bg-rose text-white' : 'border-line bg-paper text-ink active:bg-oat'
              }`}
            >
              {name === ALL ? 'Everyone' : name}
              <span className={`ml-1.5 ${on ? 'text-white/80' : 'text-ink-soft'}`}>{n}</span>
            </button>
          )
        })}
      </div>

      {person !== ALL && shown.length > 0 && (
        <h2 className="px-5 pt-4 text-2xl font-semibold text-rose-dark">
          {person === JUST_FOR_ME ? 'Made just for you' : `Made for ${person}`}
        </h2>
      )}

      <div className="grid grid-cols-2 gap-3 px-5 pt-3 pb-10">
        {shown.map((p) => (
          <GalleryTile key={p.id} p={p} showFor={person === ALL} />
        ))}
      </div>

      {finished && shown.length === 0 && (
        <p className="px-9 pt-4 text-center text-lg leading-relaxed text-ink-soft">
          {person === JUST_FOR_ME
            ? 'Nothing just for you yet. You deserve something cozy too!'
            : `Nothing finished for ${person} yet. When you finish a project made for ${person}, it’ll be kept here.`}
        </p>
      )}
    </>
  )
}
