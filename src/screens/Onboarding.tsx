import { useState, type ReactNode } from 'react'
import { GIFT_MESSAGE } from '../config'
import { isStandalone } from '../lib/platform'
import { setSetting } from '../lib/settings'
import { InstallGuide } from '../components/InstallGuide'
import { Button } from '../components/ui'
import { HeartIcon, YarnBallArt } from '../components/Icons'

type Step = 'welcome' | 0 | 1 | 2 | 'install'

/** The note, split into paragraphs on blank lines. */
export function GiftNote({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {GIFT_MESSAGE.note.split(/\n\s*\n/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  )
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center px-7 text-center">
      <div className="animate-rise mt-10" style={{ animationDelay: '0.05s' }}>
        <YarnBallArt size={150} />
      </div>
      <h1
        className="animate-rise mt-6 text-[2.5rem] leading-[1.1] font-semibold text-rose-dark"
        style={{ animationDelay: '0.2s' }}
      >
        {GIFT_MESSAGE.headline}
      </h1>
      <div className="stitch-rule animate-rise my-5 w-40" style={{ animationDelay: '0.3s' }} />
      <div className="animate-rise" style={{ animationDelay: '0.4s' }}>
        <GiftNote className="max-w-sm text-lg leading-relaxed text-ink" />
      </div>
      <p
        className="animate-rise mt-5 font-serif text-2xl text-rose-dark italic"
        style={{ animationDelay: '0.5s' }}
      >
        {GIFT_MESSAGE.signoff}
      </p>
      <div className="flex-1" />
      <Button className="animate-rise mt-10 mb-8 w-full max-w-sm" style={{ animationDelay: '0.7s' }} onClick={onNext}>
        Open your gift
      </Button>
    </div>
  )
}

const SLIDES: { title: string; body: string; art: ReactNode }[] = [
  {
    title: 'Your projects, all in one place',
    body: 'Keep every sweater, belt and canvas here, with the pattern, yarn, needle size, notes and progress photos.',
    art: <YarnBallArt size={120} />,
  },
  {
    title: 'A row counter that never forgets',
    body: 'Tap anywhere to count a row. Keep several counters per project and set a reminder like “at row 40, start the decrease.”',
    art: (
      <div className="flex h-32 w-32 flex-col items-center justify-center rounded-[2rem] bg-rose text-white shadow-md">
        <span className="font-serif text-6xl leading-none font-semibold">40</span>
        <span className="mt-1 text-sm font-semibold tracking-wide uppercase opacity-80">rows</span>
      </div>
    ),
  },
  {
    title: 'Made with Love',
    body: 'Every finished piece is saved to a family gallery, so you can see everything you’ve made for each person.',
    art: (
      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-rose-soft text-rose">
        <HeartIcon size={72} strokeWidth={1.5} />
      </div>
    ),
  },
]

function Intro({ index, onNext, onBack, onSkip }: { index: number; onNext: () => void; onBack: () => void; onSkip: () => void }) {
  const s = SLIDES[index]
  return (
    <div className="flex flex-1 flex-col px-7">
      <div className="flex h-14 items-center justify-end">
        <button onClick={onSkip} className="min-h-12 px-3 text-lg font-semibold text-ink-soft">
          Skip
        </button>
      </div>
      <div key={index} className="animate-rise flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-8 flex h-40 items-center">{s.art}</div>
        <h2 className="mb-3 text-3xl leading-tight font-semibold">{s.title}</h2>
        <p className="max-w-sm text-lg leading-relaxed text-ink-soft">{s.body}</p>
      </div>
      <div className="my-6 flex justify-center gap-2" aria-hidden="true">
        {SLIDES.map((_, i) => (
          <span key={i} className={`h-2.5 rounded-full transition-all ${i === index ? 'w-7 bg-rose' : 'w-2.5 bg-line'}`} />
        ))}
      </div>
      <div className="mb-8 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-[2]" onClick={onNext}>
          {index === SLIDES.length - 1 ? 'Let’s go' : 'Next'}
        </Button>
      </div>
    </div>
  )
}

function InstallStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-1 flex-col px-6">
      <div className="mt-10 mb-6 text-center">
        <h2 className="text-3xl leading-tight font-semibold">Put it on your Home Screen</h2>
        <p className="mt-3 text-lg text-ink-soft">
          It’ll get its own icon, open full screen, and work even without Wi-Fi.
        </p>
      </div>
      <InstallGuide />
      <div className="flex-1" />
      <Button variant="ghost" className="mt-6 mb-8" onClick={onDone}>
        I’ll do this later
      </Button>
    </div>
  )
}

export function Onboarding() {
  const [step, setStep] = useState<Step>('welcome')
  const standalone = isStandalone()

  const finish = () => setSetting('onboarded', true)
  const afterIntro = () => (standalone ? finish() : setStep('install'))

  return (
    <div className="knit-texture pt-safe pb-safe fixed inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-xl flex-col">
        {step === 'welcome' && <Welcome onNext={() => setStep(0)} />}
        {typeof step === 'number' && (
          <Intro
            index={step}
            onBack={() => setStep(step === 0 ? 'welcome' : ((step - 1) as Step))}
            onNext={() => (step === SLIDES.length - 1 ? afterIntro() : setStep((step + 1) as Step))}
            onSkip={afterIntro}
          />
        )}
        {step === 'install' && <InstallStep onDone={finish} />}
      </div>
    </div>
  )
}
