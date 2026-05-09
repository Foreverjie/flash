/**
 * 4-step onboarding flow.
 * Welcome → Sign up → Interests → Feeds.
 * Layout matches the Flash design system handoff (Stage: eyebrow + step dots,
 * centered body, footer with secondary text + primary CTA).
 */
import { Logo } from "@follow/components/icons/logo.jsx"
import { Button } from "@follow/components/ui/button/index.js"
import { Input } from "@follow/components/ui/input/index.js"
import { tracker } from "@follow/tracker"
import { cn } from "@follow/utils"
import { useMemo, useState } from "react"

const COPY = {
  eyebrow: "AI · Reading agent",
  welcomeTitle: "The AI that reads the internet for you.",
  welcomeBody:
    "Flash watches your sources, summarises what's worth knowing, and surfaces it in one timeline.",
  interestsTitle: "What should the agent watch?",
  interestsBody: "Pick a few topics. Flash will tune its summaries and brief you each morning.",
  feedsTitle: "Starter sources",
  feedsBody:
    "We've matched these to your topics. The agent will read them and you'll only see what matters.",
  cta: "Start reading",
} as const

type Topic = { id: string; label: string; color: string }
const TOPICS: Topic[] = [
  { id: "tech", label: "Tech", color: "var(--c-blue)" },
  { id: "ai", label: "AI", color: "var(--c-violet)" },
  { id: "design", label: "Design", color: "var(--c-pink)" },
  { id: "startups", label: "Startups", color: "var(--c-orange)" },
  { id: "science", label: "Science", color: "var(--c-teal)" },
  { id: "climate", label: "Climate", color: "var(--c-emerald)" },
  { id: "politics", label: "Politics", color: "var(--c-red)" },
  { id: "culture", label: "Culture", color: "var(--c-amber)" },
  { id: "books", label: "Books", color: "var(--c-brown)" },
  { id: "film", label: "Film", color: "var(--c-indigo)" },
  { id: "music", label: "Music", color: "var(--c-purple)" },
  { id: "photo", label: "Photography", color: "var(--c-slate)" },
  { id: "gaming", label: "Gaming", color: "var(--c-rose)" },
  { id: "sports", label: "Sports", color: "var(--c-lime)" },
  { id: "finance", label: "Finance", color: "var(--c-cyan)" },
  { id: "travel", label: "Travel", color: "var(--c-sky)" },
]

type Feed = { id: string; name: string; host: string; kind: string; initial: string; color: string }
const FEEDS: Feed[] = [
  {
    id: "verge",
    name: "The Verge",
    host: "theverge.com",
    kind: "Tech magazine",
    initial: "V",
    color: "#FA4D2A",
  },
  {
    id: "stratech",
    name: "Stratechery",
    host: "stratechery.com",
    kind: "Newsletter",
    initial: "S",
    color: "#0B6FA8",
  },
  {
    id: "hn",
    name: "Hacker News",
    host: "news.ycombinator.com",
    kind: "Aggregator",
    initial: "Y",
    color: "#FF6600",
  },
  {
    id: "df",
    name: "Daring Fireball",
    host: "daringfireball.net",
    kind: "Blog",
    initial: "D",
    color: "#0D1622",
  },
  {
    id: "rauno",
    name: "rauno.me",
    host: "rauno.me",
    kind: "Blog · Design",
    initial: "R",
    color: "#1F1F1F",
  },
  {
    id: "ringer",
    name: "The Ringer",
    host: "theringer.com",
    kind: "Culture",
    initial: "T",
    color: "#E6332A",
  },
  {
    id: "lenny",
    name: "Lenny's Newsletter",
    host: "lennysnewsletter.com",
    kind: "Newsletter",
    initial: "L",
    color: "#0EA5A5",
  },
  {
    id: "acq",
    name: "Acquired",
    host: "acquired.fm",
    kind: "Podcast",
    initial: "A",
    color: "#E96A0E",
  },
  {
    id: "nyt",
    name: "NYT · Tech",
    host: "nytimes.com",
    kind: "Newspaper",
    initial: "N",
    color: "#1A1A1A",
  },
]

const TOTAL_STEPS = 4

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i + 1 === step ? "w-6 bg-accent" : "w-1.5 bg-border",
          )}
        />
      ))}
    </div>
  )
}

function Stage({
  eyebrow,
  step,
  children,
  footer,
}: {
  eyebrow: string
  step: number
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="relative flex size-full flex-col bg-background text-text">
      <div className="flex min-h-10 flex-none items-center justify-between gap-3 px-7 pt-5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
          {eyebrow}
        </span>
        <StepDots step={step} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-14">
        {children}
      </div>
      <div className="border-border-secondary flex flex-none items-center justify-between gap-3 border-t p-7">
        {footer}
      </div>
    </div>
  )
}

function FlashGlyph({ size = 76 }: { size?: number }) {
  return <Logo style={{ width: size, height: size, borderRadius: 18 }} />
}

function ScreenWelcome({ onNext }: { onNext: () => void }) {
  return (
    <Stage
      eyebrow={COPY.eyebrow}
      step={1}
      footer={
        <>
          <span className="text-[11px] text-text-secondary">
            By continuing you agree to our terms.
          </span>
          <span className="text-xs text-text-secondary">Step 1 of 4</span>
        </>
      }
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-7 text-center">
        <FlashGlyph size={76} />
        <h1 className="m-0 text-balance text-[56px] font-semibold leading-[1.04] -tracking-wide text-text">
          {COPY.welcomeTitle}
        </h1>
        <p className="m-0 max-w-[520px] text-[17px] leading-normal text-text-secondary">
          {COPY.welcomeBody}
        </p>
        <div className="mt-2 flex items-center gap-2.5">
          <Button variant="primary" buttonClassName="h-12 px-5 text-sm" onClick={onNext}>
            Get started
            <i className="i-mgc-arrow-right-cute-re ml-1 size-4" />
          </Button>
          <Button variant="ghost" buttonClassName="h-12 px-5 text-sm" onClick={onNext}>
            I already have an account
          </Button>
        </div>
      </div>
    </Stage>
  )
}

function ScreenSignup({ onNext }: { onNext: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  return (
    <Stage
      eyebrow="Step 02 · Account"
      step={2}
      footer={
        <>
          <span className="text-xs text-text-secondary">
            Already have an account? <span className="font-semibold text-accent">Sign in</span>
          </span>
          <span className="text-xs text-text-secondary">2 / 4</span>
        </>
      }
    >
      <div className="mx-auto flex w-full max-w-[380px] flex-col gap-5">
        <div>
          <h2 className="m-0 text-[30px] font-semibold tracking-[-0.02em] text-text">
            Create your account
          </h2>
          <p className="m-0 mt-1.5 text-sm leading-normal text-text-secondary">
            Sync feeds across web, desktop, and mobile.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="At least 8 characters"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button variant="primary" buttonClassName="h-12" onClick={onNext}>
          Continue
        </Button>
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-text-tertiary">
          <span className="bg-separator h-px flex-1" />
          or
          <span className="bg-separator h-px flex-1" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" buttonClassName="h-10">
            <i className="i-mgc-google-cute-fi size-4" />
          </Button>
          <Button variant="outline" buttonClassName="h-10">
            <i className="i-mgc-apple-cute-fi size-4" />
          </Button>
          <Button variant="outline" buttonClassName="h-10">
            <i className="i-mgc-github-cute-fi size-4" />
          </Button>
        </div>
      </div>
    </Stage>
  )
}

function ScreenInterests({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(["ai", "design", "science"]))
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  return (
    <Stage
      eyebrow="Step 03 · Topics"
      step={3}
      footer={
        <>
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-text-secondary"
            onClick={onNext}
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">{selected.size} selected</span>
            <Button variant="primary" buttonClassName="h-9 px-4 text-sm" onClick={onNext}>
              Continue
              <i className="i-mgc-arrow-right-cute-re ml-1 size-3.5" />
            </Button>
          </div>
        </>
      }
    >
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <div>
          <h2 className="m-0 text-[28px] font-semibold tracking-[-0.02em] text-text">
            {COPY.interestsTitle}
          </h2>
          <p className="m-0 mt-1.5 text-[13px] leading-normal text-text-secondary">
            {COPY.interestsBody}
          </p>
        </div>
        <div className="grid grid-cols-6 justify-items-center gap-x-3 gap-y-7">
          {TOPICS.map((topic) => (
            <TopicDot
              key={topic.id}
              topic={topic}
              selected={selected.has(topic.id)}
              onToggle={() => toggle(topic.id)}
            />
          ))}
        </div>
      </div>
    </Stage>
  )
}

function TopicDot({
  topic,
  selected,
  onToggle,
}: {
  topic: Topic
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0"
    >
      <div
        className="relative flex items-center justify-center rounded-full transition-all"
        style={{
          width: 76,
          height: 76,
          background: selected ? topic.color : "var(--fill-1)",
          border: selected ? "0" : "1px solid var(--border)",
          boxShadow: selected ? "0 4px 14px -4px rgba(0,0,0,0.18)" : "none",
        }}
      >
        {selected && (
          <span
            className="absolute -right-0.5 -top-0.5 flex size-[22px] items-center justify-center rounded-full border-2"
            style={{
              background: "var(--fo-accent)",
              borderColor: "var(--bg-1)",
            }}
          >
            <i className="i-mgc-check-cute-fi size-2.5" style={{ color: "var(--fo-accent-fg)" }} />
          </span>
        )}
      </div>
      <span
        className={cn(
          "whitespace-nowrap text-center text-xs text-text-secondary",
          selected && "font-semibold text-text",
        )}
      >
        {topic.label}
      </span>
    </button>
  )
}

function ScreenFeeds({ onFinish }: { onFinish: () => void }) {
  const [following, setFollowing] = useState<Set<string>>(new Set(["verge", "stratech", "rauno"]))
  const toggle = (id: string) =>
    setFollowing((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <Stage
      eyebrow="Step 04 · Sources"
      step={4}
      footer={
        <>
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-text-secondary"
          >
            Add your own URL
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">{following.size} following</span>
            <Button variant="primary" buttonClassName="h-9 px-4 text-sm" onClick={onFinish}>
              {COPY.cta}
              <i className="i-mgc-arrow-right-cute-re ml-1 size-3.5" />
            </Button>
          </div>
        </>
      }
    >
      <div className="mx-auto flex w-full max-w-[780px] flex-col gap-5">
        <div>
          <h2 className="m-0 text-[28px] font-semibold tracking-[-0.02em] text-text">
            {COPY.feedsTitle}
          </h2>
          <p className="m-0 mt-1.5 text-[13px] leading-normal text-text-secondary">
            {COPY.feedsBody}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FEEDS.map((feed) => (
            <FeedCard
              key={feed.id}
              feed={feed}
              followed={following.has(feed.id)}
              onToggle={() => toggle(feed.id)}
            />
          ))}
        </div>
      </div>
    </Stage>
  )
}

function FeedCard({
  feed,
  followed,
  onToggle,
}: {
  feed: Feed
  followed: boolean
  onToggle: () => void
}) {
  return (
    <div
      className="relative flex items-center gap-3 rounded-[10px] bg-background px-3.5 py-2.5"
      style={{
        border: followed
          ? "1px solid color-mix(in srgb, var(--fo-accent) 50%, var(--border))"
          : "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="flex size-[38px] flex-none items-center justify-center rounded-lg text-base font-bold text-white"
        style={{ background: feed.color, boxShadow: "var(--shadow-card)" }}
      >
        {feed.initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-text">{feed.name}</div>
        <div className="truncate font-mono text-[11px] text-text-tertiary">
          {feed.host} · {feed.kind}
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "inline-flex h-7 cursor-pointer items-center gap-1 rounded-md text-xs font-semibold",
          followed ? "border-0 px-2 pl-1.5" : "border border-border bg-background px-3 text-text",
        )}
        style={
          followed ? { background: "var(--fo-accent)", color: "var(--fo-accent-fg)" } : undefined
        }
      >
        {followed && (
          <i className="i-mgc-check-cute-fi size-2.5" style={{ color: "var(--fo-accent-fg)" }} />
        )}
        {followed ? "Following" : "Follow"}
      </button>
    </div>
  )
}

export function OnboardingFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1)

  const trackedStep = useMemo(() => {
    switch (step) {
      case 1: {
        return "intro"
      }
      case 2: {
        return "intro"
      }
      case 3: {
        return "selecting-feeds"
      }
      case 4: {
        return "selecting-feeds"
      }
      default: {
        return "finish"
      }
    }
  }, [step])

  // Best-effort progress tracking via the existing onboarding tracker.
  // Wrapped in try/catch because the tracker shape varies across builds.
  useMemo(() => {
    try {
      tracker.onBoarding({ stepV2: trackedStep as never, done: false })
    } catch {
      // ignore
    }
    return null
  }, [trackedStep])

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  const finish = () => {
    try {
      tracker.onBoarding({ stepV2: "finish" as never, done: true })
    } catch {
      // ignore
    }
    onClose()
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {step === 1 && <ScreenWelcome onNext={next} />}
      {step === 2 && <ScreenSignup onNext={next} />}
      {step === 3 && <ScreenInterests onNext={next} />}
      {step === 4 && <ScreenFeeds onFinish={finish} />}
    </div>
  )
}
