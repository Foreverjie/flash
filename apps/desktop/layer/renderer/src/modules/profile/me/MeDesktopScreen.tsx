import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { useFeedById } from "@follow/store/feed/hooks"
import {
  useAllFeedSubscriptionIds,
  useFeedSubscriptionCount,
  useListSubscriptionCount,
} from "@follow/store/subscription/hooks"
import { useWhoami } from "@follow/store/user/hooks"
import { cn } from "@follow/utils/utils"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"

import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { replaceImgUrlIfNeed } from "~/lib/img-proxy"
import { LoginModalContent } from "~/modules/auth/LoginModalContent"
import { useMobileBrandStyle } from "~/modules/mobile-web/mobile-brand-style"
import { signOut } from "~/queries/auth"

import { FeedIcon } from "../../feed/feed-icon"
import type { MeAchievement, MeSettingItem, MeStat } from "./me-parts"
import {
  BoltMotif,
  buildReadingHeatmap,
  feedFrequencyLabel,
  feedHost,
  formatJoined,
  HEAT_COLORS,
  useMeAchievements,
  useMeHighlights,
  useMeSettings,
  useMeStats,
} from "./me-parts"

export function MeDesktopScreen() {
  const { t } = useTranslation()
  const brandStyle = useMobileBrandStyle()
  const user = useWhoami()
  const navigate = useNavigate()
  const { present } = useModalStack()

  const feedCount = useFeedSubscriptionCount()
  const listCount = useListSubscriptionCount()
  const subscriptionIds = useAllFeedSubscriptionIds()

  const stats = useMeStats(feedCount, listCount)
  const highlights = useMeHighlights()
  const achievements = useMeAchievements()
  const settings = useMeSettings(user?.email)

  if (!user) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-4 px-6">
        <EmptyStage
          eyebrow={t("words.login")}
          glyph={<i className="i-mgc-user-3-cute-re" />}
          title={t("mobile.profile.signed_out_title")}
          size="lg"
        />
        <button
          type="button"
          className="mt-2 rounded-full bg-brand-accent px-6 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-80"
          onClick={() => {
            present({
              CustomModalComponent: PlainModal,
              title: t("words.login"),
              id: "login",
              content: () => <LoginModalContent runtime="browser" />,
              clickOutsideToDismiss: true,
            })
          }}
        >
          {t("words.login")}
        </button>
      </div>
    )
  }

  const initial = (user.name || user.handle || "?").slice(0, 1).toUpperCase()

  return (
    <div className="relative flex size-full flex-col bg-background text-text" style={brandStyle}>
      <div className="absolute inset-0 overflow-y-auto">
        {/* Branded cover — deepest layer, behind the avatar + content */}
        <div className="relative z-0 h-[150px] overflow-hidden bg-folo">
          <BoltMotif
            size={230}
            color="rgba(26,18,7,0.11)"
            className="pointer-events-none absolute -top-9 right-14"
          />
          <BoltMotif
            size={120}
            color="rgba(26,18,7,0.08)"
            className="pointer-events-none absolute left-[70px] top-11"
          />
          <BoltMotif
            size={78}
            color="rgba(26,18,7,0.07)"
            className="pointer-events-none absolute -top-2 left-[300px]"
          />
          <BoltMotif
            size={150}
            color="rgba(26,18,7,0.06)"
            className="pointer-events-none absolute right-[280px] top-[60px]"
          />
        </div>

        <div className="relative z-10 mx-auto max-w-[1000px] px-12 pb-20">
          {/* Profile head (overlaps the cover) */}
          <div className="mt-[-52px] flex items-end gap-5">
            {user.image ? (
              <img
                src={replaceImgUrlIfNeed(user.image)}
                alt=""
                className="size-[116px] shrink-0 rounded-[28px] border-[5px] border-background object-cover shadow-lg"
              />
            ) : (
              <div className="flex size-[116px] shrink-0 items-center justify-center rounded-[28px] border-[5px] border-background bg-accent text-5xl font-bold text-white shadow-lg">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1 pb-1.5">
              <h1 className="text-[30px] font-semibold tracking-[-0.02em] text-text">
                {user.name || user.handle}
              </h1>
              <div className="mt-0.5 text-sm text-text-tertiary">
                {[user.handle ? `@${user.handle}` : null, formatJoined(user.createdAt, t)]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="flex gap-2.5 pb-1.5">
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="flex h-[38px] items-center gap-1.5 rounded-[10px] border border-border bg-background px-3.5 text-[13.5px] font-semibold text-text transition-colors hover:bg-fill-secondary"
              >
                <i className="i-mgc-settings-7-cute-re" />
                {t("me.actions.settings")}
              </button>
              <button
                type="button"
                onClick={() => navigate("/settings/profile")}
                className="h-[38px] rounded-[10px] bg-brand-accent px-[18px] text-[13.5px] font-bold text-black transition-opacity hover:opacity-90"
              >
                {t("me.actions.edit_profile")}
              </button>
            </div>
          </div>

          <p className="mt-4 max-w-[600px] text-[15.5px] leading-relaxed text-text-secondary">
            {t("me.bio")}
          </p>

          {/* Big stats */}
          <div className="border-border-secondary bg-secondary-system-background mt-7 grid grid-cols-4 overflow-hidden rounded-2xl border">
            {stats.map((stat, i) => (
              <StatCell key={stat.id} stat={stat} first={i === 0} />
            ))}
          </div>

          {/* Year in reading */}
          <section className="mt-11">
            <BoldSection kicker={t("me.year.kicker")} title={t("me.year.title")} />
            <div className="border-border-secondary grid grid-cols-[1fr_280px] gap-7 rounded-2xl border bg-background p-[22px]">
              <ReadingHeatmap activeDaysLabel={t("me.heatmap.active_days", { count: 182 })} />
              <div className="border-border-secondary flex flex-col gap-3.5 border-l pl-6">
                {highlights.map((h) => (
                  <div key={h.id}>
                    <div className="text-[19px] font-bold tracking-[-0.01em] text-text">
                      {h.value}
                    </div>
                    <div className="mt-px text-xs text-text-tertiary">{h.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Achievements */}
          <section className="mt-11">
            <BoldSection
              kicker={t("me.achievements.kicker")}
              title={t("me.achievements.title")}
              action={t("me.actions.view_all")}
            />
            <div className="grid grid-cols-3 gap-3">
              {achievements.map((a) => (
                <AchievementCard key={a.id} ach={a} />
              ))}
            </div>
          </section>

          {/* Subscriptions + Settings */}
          <section className="mt-11 grid grid-cols-2 items-start gap-7">
            <div>
              <BoldSection
                kicker={t("me.subscriptions.kicker")}
                title={t("me.subscriptions.title")}
                action={t("me.subscriptions.see_all", { count: feedCount })}
              />
              <div className="border-border-secondary overflow-hidden rounded-[14px] border bg-background">
                {subscriptionIds.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-text-tertiary">
                    {t("me.subscriptions.empty")}
                  </div>
                ) : (
                  subscriptionIds
                    .slice(0, 5)
                    .map((id, i) => <SubscriptionRow key={id} feedId={id} first={i === 0} />)
                )}
              </div>
            </div>
            <div>
              <BoldSection kicker={t("me.settings.kicker")} title={t("me.settings.title")} />
              <div className="border-border-secondary overflow-hidden rounded-[14px] border bg-background">
                {settings.map((item, i) => (
                  <SettingsRow
                    key={item.id}
                    item={item}
                    first={i === 0}
                    onClick={() => navigate(item.to)}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="mt-3.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-[13.5px] font-semibold text-red transition-colors hover:bg-fill-secondary"
              >
                <i className="i-mgc-exit-cute-re" />
                {t("mobile.profile.sign_out")}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function StatCell({ stat, first }: { stat: MeStat; first: boolean }) {
  return (
    <div className={cn("px-[22px] py-5", !first && "border-border-secondary border-l")}>
      <div
        className={cn(
          "flex items-center gap-2 text-[38px] font-bold tabular-nums leading-none tracking-[-0.03em]",
          stat.accent ? "text-accent" : "text-text",
        )}
      >
        {stat.accent && <i className="i-mgc-fire-cute-fi text-[28px] text-red" />}
        {stat.value}
      </div>
      <div className="mt-1.5 text-[13px] font-semibold text-text-tertiary">{stat.label}</div>
    </div>
  )
}

function BoldSection({
  kicker,
  title,
  action,
}: {
  kicker: string
  title: string
  action?: string
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-accent">
          {kicker}
        </div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-text">{title}</h2>
      </div>
      {action && (
        <button
          type="button"
          className="flex items-center gap-1 text-[13px] font-semibold text-text-secondary"
        >
          {action}
          <i className="i-mgc-right-cute-re text-sm" />
        </button>
      )}
    </div>
  )
}

function ReadingHeatmap({ activeDaysLabel }: { activeDaysLabel: string }) {
  const { t } = useTranslation()
  const weeks = buildReadingHeatmap(26)
  const dayLabels = ["", "M", "", "W", "", "F", ""]
  return (
    <div>
      <div className="flex gap-2">
        <div className="flex flex-col gap-1">
          {dayLabels.map((d, i) => (
            <div key={i} className="h-[13px] w-3 text-[9px] leading-[13px] text-text-quaternary">
              {d}
            </div>
          ))}
        </div>
        <div className="flex flex-1 gap-1 overflow-hidden">
          {weeks.map((col, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {col.map((lvl, di) => (
                <div
                  key={di}
                  className="size-[13px] rounded-[3px]"
                  style={{ background: HEAT_COLORS[lvl] }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3.5 flex items-center gap-1.5 text-[11px] text-text-tertiary">
        <span>{t("me.heatmap.less")}</span>
        {HEAT_COLORS.map((c, i) => (
          <div key={i} className="size-[11px] rounded-[3px]" style={{ background: c }} />
        ))}
        <span>{t("me.heatmap.more")}</span>
        <span className="flex-1" />
        <span className="font-semibold text-text-secondary">{activeDaysLabel}</span>
      </div>
    </div>
  )
}

function AchievementCard({ ach }: { ach: MeAchievement }) {
  const locked = !ach.unlocked
  return (
    <div
      className={cn(
        "border-border-secondary bg-secondary-system-background relative flex items-center gap-3.5 overflow-hidden rounded-[14px] border px-4 py-3.5",
        locked && "opacity-95",
      )}
    >
      <div
        className="flex size-[46px] shrink-0 items-center justify-center rounded-xl text-[22px] text-white"
        style={locked ? undefined : { background: ach.color }}
        data-locked={locked || undefined}
      >
        <i
          className={cn(ach.icon, locked && "text-text-quaternary")}
          style={locked ? undefined : { color: "#fff" }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-text">{ach.name}</div>
        <div className="mt-px text-xs text-text-tertiary">{ach.desc}</div>
        {locked && ach.progress != null && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-fill-secondary">
            <div
              className="h-full rounded-full bg-brand-accent"
              style={{ width: `${Math.round(ach.progress * 100)}%` }}
            />
          </div>
        )}
      </div>
      {!locked && <i className="i-mgc-check-cute-re shrink-0 text-base text-green" />}
    </div>
  )
}

function SubscriptionRow({ feedId, first }: { feedId: string; first: boolean }) {
  const feed = useFeedById(feedId)
  const { t } = useTranslation()
  if (!feed) return null
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        !first && "border-border-secondary border-t",
      )}
    >
      <FeedIcon target={feed} size={34} className="shrink-0 rounded-lg" noMargin />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-text">{feed.title}</div>
        <div className="font-mono text-[11.5px] text-text-tertiary">{feedHost(feed)}</div>
      </div>
      <span className="rounded-full bg-fill-secondary px-2 py-0.5 text-[11px] font-semibold text-text-tertiary">
        {feedFrequencyLabel(feed, t)}
      </span>
      <button
        type="button"
        className="flex size-[30px] items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-fill-secondary"
      >
        <i className="i-mgc-more-1-cute-re text-base" />
      </button>
    </div>
  )
}

function SettingsRow({
  item,
  first,
  onClick,
}: {
  item: MeSettingItem
  first: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-fill-secondary",
        !first && "border-border-secondary border-t",
      )}
    >
      <i className={cn(item.icon, "text-lg text-text-tertiary")} />
      <div className="min-w-0 flex-1 text-sm font-semibold text-text">{item.label}</div>
      <span className="truncate text-[12.5px] text-text-tertiary">{item.sub}</span>
      <i className="i-mgc-right-cute-re text-text-quaternary" />
    </button>
  )
}
