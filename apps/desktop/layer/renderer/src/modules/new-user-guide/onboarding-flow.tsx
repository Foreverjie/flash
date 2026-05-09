/**
 * 3-step onboarding flow.
 * Welcome (auth-gate via LoginModal) → Interests (topics) → Feeds (curated by selected topics).
 *
 * Topics and feeds come from the API. On finish we POST /topics/onboarding/subscribe
 * with the selected feedIds and subscribe idempotently.
 */
import { Logo } from "@follow/components/icons/logo.jsx"
import { Button } from "@follow/components/ui/button/index.js"
import { tracker } from "@follow/tracker"
import { cn } from "@follow/utils"
import type { Transition, Variants } from "motion/react"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import { useEffect, useMemo, useRef, useState } from "react"

import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { LoginModalContent } from "~/modules/auth/LoginModalContent"
import { useSession } from "~/queries/auth"
import {
  useFeedsForTopicsQuery,
  useOnboardingSubscribeMutation,
  useTopicsQuery,
} from "~/queries/topics"

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

const TOTAL_STEPS = 3

const EASE_OUT_QUART: [number, number, number, number] = [0.25, 1, 0.5, 1]
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

const STEP_TRANSITION: Transition = { duration: 0.32, ease: EASE_OUT_QUART }

// Fallback palette used when a topic record has no color set on the server.
const TOPIC_FALLBACK_COLORS = [
  "var(--c-blue)",
  "var(--c-violet)",
  "var(--c-pink)",
  "var(--c-orange)",
  "var(--c-teal)",
  "var(--c-emerald)",
  "var(--c-red)",
  "var(--c-amber)",
  "var(--c-indigo)",
  "var(--c-purple)",
  "var(--c-cyan)",
  "var(--c-rose)",
]

const TOPIC_SKELETON_KEYS = Array.from({ length: 12 }, (_, i) => `topic-skeleton-${i}`)
const FEED_SKELETON_KEYS = Array.from({ length: 6 }, (_, i) => `feed-skeleton-${i}`)

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const isActive = i + 1 === step
        const isCompleted = i + 1 < step
        return (
          <m.span
            key={i}
            className={cn(
              "h-1.5 rounded-full",
              isActive ? "bg-accent" : isCompleted ? "bg-accent/60" : "bg-border",
            )}
            initial={false}
            animate={{ width: isActive ? 24 : 6 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          />
        )
      })}
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
      <div className="flex min-h-7 flex-none items-center justify-between gap-3 px-5 pt-3 sm:min-h-10 sm:px-7 sm:pt-5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent sm:text-[11px]">
          {eyebrow}
        </span>
        <StepDots step={step} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-3 sm:overflow-hidden sm:px-14 sm:py-0">
        {children}
      </div>
      <div className="flex flex-none flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border px-5 py-4 sm:flex-nowrap sm:p-7">
        {footer}
      </div>
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  const reduceMotion = useReducedMotion()
  return (
    <m.button
      type="button"
      onClick={onClick}
      aria-label="Back to previous step"
      initial={reduceMotion ? false : { opacity: 0, x: 4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT_QUART }}
      whileHover={reduceMotion ? undefined : { x: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      className={cn(
        "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium",
        "border border-border bg-background text-text-secondary",
        "transition-colors duration-200 hover:text-text",
      )}
    >
      <i className="i-mgc-arrow-left-cute-re size-3.5" />
      Back
    </m.button>
  )
}

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT_QUART } },
}

function StepContent({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return <>{children}</>
  return (
    <m.div variants={containerVariants} initial="hidden" animate="visible" className="contents">
      {children}
    </m.div>
  )
}

function Item({
  children,
  className,
  as: As = "div",
}: {
  children: React.ReactNode
  className?: string
  as?: "div" | "h1" | "h2" | "p" | "span"
}) {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) {
    switch (As) {
      case "h1": {
        return <h1 className={className}>{children}</h1>
      }
      case "h2": {
        return <h2 className={className}>{children}</h2>
      }
      case "p": {
        return <p className={className}>{children}</p>
      }
      case "span": {
        return <span className={className}>{children}</span>
      }
      default: {
        return <div className={className}>{children}</div>
      }
    }
  }
  switch (As) {
    case "h1": {
      return (
        <m.h1 variants={itemVariants} className={className}>
          {children}
        </m.h1>
      )
    }
    case "h2": {
      return (
        <m.h2 variants={itemVariants} className={className}>
          {children}
        </m.h2>
      )
    }
    case "p": {
      return (
        <m.p variants={itemVariants} className={className}>
          {children}
        </m.p>
      )
    }
    case "span": {
      return (
        <m.span variants={itemVariants} className={className}>
          {children}
        </m.span>
      )
    }
    default: {
      return (
        <m.div variants={itemVariants} className={className}>
          {children}
        </m.div>
      )
    }
  }
}

/**
 * Open the existing login/signup modal. Resolves once the user is authenticated
 * and the session query reports a logged-in user; rejects if the modal is
 * dismissed without auth.
 */
function useRequireAuth() {
  const modalStack = useModalStack()
  const { status } = useSession()

  return (initialState: "register" | "login"): Promise<boolean> => {
    if (status === "authenticated") return Promise.resolve(true)
    return new Promise<boolean>((resolve) => {
      const modalId = "onboarding-login"
      modalStack.present({
        CustomModalComponent: PlainModal,
        title: initialState === "login" ? "Sign in" : "Sign up",
        id: modalId,
        overlay: true,
        content: () => (
          <LoginModalContent
            runtime={window.electron ? "app" : "browser"}
            initialState={initialState}
            onBack={() => modalStack.dismissTop()}
          />
        ),
        clickOutsideToDismiss: true,
        onClose: () => {
          // The session query refetches automatically on auth changes; we
          // resolve true if a user is now present, false otherwise. The
          // caller re-reads `useSession().status` to decide whether to
          // proceed, so resolution value here is informational only.
          resolve(true)
        },
      })
    })
  }
}

function ScreenWelcome({ onAuthed }: { onAuthed: () => void }) {
  const requireAuth = useRequireAuth()
  const { status } = useSession()

  // If the user is already authenticated when this screen mounts, hop forward.
  useEffect(() => {
    if (status === "authenticated") onAuthed()
  }, [status, onAuthed])

  const handleStart = async (initialState: "register" | "login") => {
    if (status === "authenticated") {
      onAuthed()
      return
    }
    await requireAuth(initialState)
    // Caller advances when session flips to authenticated via the effect above.
  }

  return (
    <Stage
      eyebrow={COPY.eyebrow}
      step={1}
      footer={
        <>
          <span className="text-[11px] text-text-secondary">
            By continuing you agree to our terms.
          </span>
          <span className="text-xs text-text-secondary">Step 1 of {TOTAL_STEPS}</span>
        </>
      }
    >
      <StepContent>
        <div className="mx-auto flex w-full max-w-[720px] flex-col items-start gap-[18px] text-left sm:items-center sm:gap-7 sm:text-center">
          <Item>
            <Logo className="size-14 rounded-[14px] sm:hidden" />
            <Logo className="hidden size-[76px] rounded-[18px] sm:inline-flex" />
          </Item>
          <Item
            as="h1"
            className="m-0 text-balance text-[30px] font-semibold leading-[1.04] -tracking-wide text-text sm:text-[56px]"
          >
            {COPY.welcomeTitle}
          </Item>
          <Item
            as="p"
            className="m-0 w-full text-sm leading-normal text-text-secondary sm:max-w-[520px] sm:text-[17px]"
          >
            {COPY.welcomeBody}
          </Item>
          <Item className="mt-1 flex w-full flex-col items-stretch gap-2.5 sm:mt-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              variant="primary"
              buttonClassName="h-12 w-full px-5 text-sm sm:w-auto"
              onClick={() => handleStart("register")}
            >
              Get started
              <i className="i-mgc-right-cute-re ml-1 size-4" />
            </Button>
            <Button
              variant="ghost"
              buttonClassName="h-12 w-full px-5 text-sm sm:w-auto"
              onClick={() => handleStart("login")}
            >
              I already have an account
            </Button>
          </Item>
        </div>
      </StepContent>
    </Stage>
  )
}

type TopicLite = {
  id: string
  slug: string
  label: string
  color: string
}

function ScreenInterests({
  topics,
  isLoading,
  selected,
  setSelected,
  onNext,
  onBack,
}: {
  topics: TopicLite[]
  isLoading: boolean
  selected: Set<string>
  setSelected: (next: Set<string>) => void
  onNext: () => void
  onBack: () => void
}) {
  const reduceMotion = useReducedMotion()
  const toggle = (slug: string) => {
    const next = new Set(selected)
    if (next.has(slug)) next.delete(slug)
    else next.add(slug)
    setSelected(next)
  }
  return (
    <Stage
      eyebrow={`Step 02 · Topics`}
      step={2}
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
            <BackButton onClick={onBack} />
            <Button
              variant="primary"
              buttonClassName="h-9 px-4 text-sm"
              onClick={onNext}
              disabled={isLoading}
            >
              Continue
              <i className="i-mgc-right-cute-re ml-1 size-3.5" />
            </Button>
          </div>
        </>
      }
    >
      <StepContent>
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
          <Item>
            <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-text sm:text-[28px]">
              {COPY.interestsTitle}
            </h2>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-text-secondary">
              {COPY.interestsBody}
            </p>
          </Item>
          {isLoading ? (
            <Item className="grid grid-cols-3 justify-items-center gap-x-2 gap-y-[18px] sm:grid-cols-6 sm:gap-x-3 sm:gap-y-7">
              {TOPIC_SKELETON_KEYS.map((key) => (
                <div
                  key={key}
                  className="size-14 animate-pulse rounded-full bg-fill-tertiary sm:size-[76px]"
                />
              ))}
            </Item>
          ) : topics.length === 0 ? (
            <Item>
              <p className="text-sm text-text-secondary">
                No topics available yet. You can skip this step and add feeds later.
              </p>
            </Item>
          ) : (
            <Item className="grid grid-cols-3 justify-items-center gap-x-2 gap-y-[18px] sm:grid-cols-6 sm:gap-x-3 sm:gap-y-7">
              {topics.map((topic, i) => (
                <TopicDot
                  key={topic.id}
                  topic={topic}
                  selected={selected.has(topic.slug)}
                  onToggle={() => toggle(topic.slug)}
                  index={i}
                  reduceMotion={!!reduceMotion}
                />
              ))}
            </Item>
          )}
        </div>
      </StepContent>
    </Stage>
  )
}

function TopicDot({
  topic,
  selected,
  onToggle,
  index,
  reduceMotion,
}: {
  topic: TopicLite
  selected: boolean
  onToggle: () => void
  index: number
  reduceMotion: boolean
}) {
  return (
    <m.button
      type="button"
      onClick={onToggle}
      className="flex w-full cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT_QUART, delay: 0.15 + index * 0.025 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
    >
      <m.div
        className="relative flex size-14 items-center justify-center rounded-full sm:size-[76px]"
        animate={{
          background: selected ? topic.color : "var(--fill-1)",
          boxShadow: selected ? "0 8px 22px -8px rgba(0,0,0,0.25)" : "0 0 0 0 rgba(0,0,0,0)",
        }}
        transition={{ duration: 0.28, ease: EASE_OUT_QUART }}
        style={{
          border: selected ? "0" : "1px solid var(--border)",
        }}
      >
        <AnimatePresence>
          {selected && (
            <m.span
              key="check"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
              className="absolute -right-0.5 -top-0.5 flex size-[22px] items-center justify-center rounded-full border-2"
              style={{ background: "var(--fo-accent)", borderColor: "var(--bg-1)" }}
            >
              <i className="i-mgc-check-filled size-2.5" style={{ color: "var(--fo-accent-fg)" }} />
            </m.span>
          )}
        </AnimatePresence>
      </m.div>
      <span
        className={cn(
          "whitespace-nowrap text-center text-xs text-text-secondary transition-colors duration-200",
          selected && "font-semibold text-text",
        )}
      >
        {topic.label}
      </span>
    </m.button>
  )
}

type FeedRow = {
  id: string
  name: string
  host: string
  kind: string
  initial: string
  color: string
}

function ScreenFeeds({
  feeds,
  isLoading,
  following,
  setFollowing,
  onFinish,
  onBack,
  finishing,
}: {
  feeds: FeedRow[]
  isLoading: boolean
  following: Set<string>
  setFollowing: (next: Set<string>) => void
  onFinish: () => void
  onBack: () => void
  finishing: boolean
}) {
  const reduceMotion = useReducedMotion()
  const toggle = (id: string) => {
    const next = new Set(following)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setFollowing(next)
  }
  return (
    <Stage
      eyebrow="Step 03 · Sources"
      step={3}
      footer={
        <>
          <span className="text-xs text-text-secondary">
            You can add custom feeds anytime from Discover.
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">{following.size} following</span>
            <BackButton onClick={onBack} />
            <Button
              variant="primary"
              buttonClassName="h-9 min-w-[136px] shrink-0 px-4 text-sm whitespace-nowrap"
              textClassName="whitespace-nowrap"
              onClick={onFinish}
              isLoading={finishing}
              disabled={finishing}
            >
              {COPY.cta}
              <i className="i-mgc-right-cute-re ml-1 size-3.5" />
            </Button>
          </div>
        </>
      }
    >
      <StepContent>
        <div className="mx-auto flex w-full max-w-[780px] flex-col gap-5">
          <Item>
            <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-text sm:text-[28px]">
              {COPY.feedsTitle}
            </h2>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-text-secondary">
              {COPY.feedsBody}
            </p>
          </Item>
          {isLoading ? (
            <Item className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FEED_SKELETON_KEYS.map((key) => (
                <div
                  key={key}
                  className="h-14 animate-pulse rounded-[10px] border border-border bg-fill-tertiary"
                />
              ))}
            </Item>
          ) : feeds.length === 0 ? (
            <Item>
              <p className="text-sm text-text-secondary">
                No starter feeds matched. You can finish and add feeds from Discover.
              </p>
            </Item>
          ) : (
            <Item className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {feeds.map((feed, i) => (
                <FeedCard
                  key={feed.id}
                  feed={feed}
                  followed={following.has(feed.id)}
                  onToggle={() => toggle(feed.id)}
                  index={i}
                  reduceMotion={!!reduceMotion}
                />
              ))}
            </Item>
          )}
        </div>
      </StepContent>
    </Stage>
  )
}

function FeedCard({
  feed,
  followed,
  onToggle,
  index,
  reduceMotion,
}: {
  feed: FeedRow
  followed: boolean
  onToggle: () => void
  index: number
  reduceMotion: boolean
}) {
  return (
    <m.div
      className="relative flex items-center gap-3 rounded-[10px] bg-background px-3.5 py-2.5"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE_OUT_QUART, delay: 0.18 + index * 0.04 }}
      whileHover={
        reduceMotion ? undefined : { y: -2, boxShadow: "0 10px 28px -10px rgba(0,0,0,0.18)" }
      }
      style={{
        border: followed
          ? "1px solid color-mix(in srgb, var(--fo-accent) 50%, var(--border))"
          : "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
        transition: "border-color 240ms cubic-bezier(0.25,1,0.5,1)",
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
      <m.button
        type="button"
        onClick={onToggle}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        className={cn(
          "inline-flex h-7 min-w-[92px] cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold",
          "transition-[background-color,color,border-color] duration-200 ease-out",
          followed ? "border-transparent" : "border-border bg-background text-text",
        )}
        style={
          followed ? { background: "var(--fo-accent)", color: "var(--fo-accent-fg)" } : undefined
        }
      >
        <span className="relative inline-flex size-3 items-center justify-center">
          <m.i
            initial={false}
            animate={{ opacity: followed ? 1 : 0, scale: followed ? 1 : 0.6 }}
            transition={{ duration: 0.18, ease: EASE_OUT_QUART }}
            className="i-mgc-check-filled absolute size-3"
            style={{ color: "var(--fo-accent-fg)" }}
          />
          <m.i
            initial={false}
            animate={{ opacity: followed ? 0 : 1, scale: followed ? 0.6 : 1 }}
            transition={{ duration: 0.18, ease: EASE_OUT_QUART }}
            className="i-mgc-add-cute-re absolute size-3"
          />
        </span>
        <span>{followed ? "Following" : "Follow"}</span>
      </m.button>
    </m.div>
  )
}

function FinishBurst() {
  return (
    <m.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
    >
      <m.div
        initial={{ scale: 0, opacity: 0.55 }}
        animate={{ scale: 14, opacity: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
        className="size-40 rounded-full"
        style={{ background: "var(--fo-accent)" }}
      />
      <m.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [0.8, 1.25, 1], opacity: [0, 1, 0] }}
        transition={{ duration: 0.65, ease: EASE_OUT_EXPO, times: [0, 0.4, 1] }}
        className="absolute"
      >
        <Logo style={{ width: 96, height: 96, borderRadius: 22 }} />
      </m.div>
    </m.div>
  )
}

const stepVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -24 }),
}

function hostFromUrl(url: string | null | undefined): string {
  if (!url) return ""
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? ""
  }
}

function colorFromHost(host: string): string {
  // Deterministic pastel color per host so cards stay visually stable.
  let hash = 0
  for (let i = 0; i < host.length; i += 1) {
    hash = (hash * 31 + (host.codePointAt(i) ?? 0)) & 0xff_ff_ff_ff
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 60%, 45%)`
}

export function OnboardingFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1)
  const prevStepRef = useRef(1)
  const direction = step >= prevStepRef.current ? 1 : -1
  const [finishing, setFinishing] = useState(false)
  const reduceMotion = useReducedMotion()

  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(() => new Set())
  const [followingFeeds, setFollowingFeeds] = useState<Set<string>>(() => new Set())

  const topicsQuery = useTopicsQuery()
  const topics: TopicLite[] = useMemo(() => {
    return (topicsQuery.data ?? []).map((t, i) => ({
      id: t.id,
      slug: t.slug,
      label: t.label,
      color: t.color || TOPIC_FALLBACK_COLORS[i % TOPIC_FALLBACK_COLORS.length]!,
    }))
  }, [topicsQuery.data])

  const selectedSlugs = useMemo(() => [...selectedTopics], [selectedTopics])
  const feedsQuery = useFeedsForTopicsQuery(selectedSlugs)
  const feedRows: FeedRow[] = useMemo(() => {
    return (feedsQuery.data ?? []).map((f) => {
      const host = hostFromUrl(f.siteUrl || f.url)
      return {
        id: f.id,
        name: f.title || host || "Untitled",
        host,
        kind: "Feed",
        initial: (f.title || host || "?").slice(0, 1).toUpperCase(),
        color: colorFromHost(host || f.id),
      }
    })
  }, [feedsQuery.data])

  // Auto-select all returned feeds when the list arrives or changes.
  useEffect(() => {
    if (!feedsQuery.data) return
    setFollowingFeeds(new Set(feedsQuery.data.map((f) => f.id)))
  }, [feedsQuery.data])

  useEffect(() => {
    prevStepRef.current = step
  }, [step])

  const trackedStep = useMemo(() => {
    switch (step) {
      case 1: {
        return "intro"
      }
      case 2: {
        return "selecting-feeds"
      }
      case 3: {
        return "selecting-feeds"
      }
      default: {
        return "finish"
      }
    }
  }, [step])

  useEffect(() => {
    try {
      tracker.onBoarding({ stepV2: trackedStep as never, done: false })
    } catch {
      // ignore
    }
  }, [trackedStep])

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  const back = () => setStep((s) => Math.max(s - 1, 1))

  const subscribeMut = useOnboardingSubscribeMutation()

  const finish = async () => {
    setFinishing(true)
    try {
      await subscribeMut.mutateAsync({
        feedIds: [...followingFeeds],
      })
    } catch (err) {
      console.error("[Onboarding] subscribe failed", err)
      setFinishing(false)
      return
    }
    try {
      tracker.onBoarding({ stepV2: "finish" as never, done: true })
    } catch {
      // ignore
    }
    if (reduceMotion) {
      onClose()
      return
    }
    window.setTimeout(onClose, 620)
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <m.div
          key={step}
          custom={direction}
          variants={reduceMotion ? undefined : stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={STEP_TRANSITION}
          className="absolute inset-0"
        >
          {step === 1 && <ScreenWelcome onAuthed={next} />}
          {step === 2 && (
            <ScreenInterests
              topics={topics}
              isLoading={topicsQuery.isLoading}
              selected={selectedTopics}
              setSelected={setSelectedTopics}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 3 && (
            <ScreenFeeds
              feeds={feedRows}
              isLoading={feedsQuery.isLoading}
              following={followingFeeds}
              setFollowing={setFollowingFeeds}
              onFinish={finish}
              onBack={back}
              finishing={finishing}
            />
          )}
        </m.div>
      </AnimatePresence>

      <AnimatePresence>{finishing && <FinishBurst />}</AnimatePresence>
    </div>
  )
}
