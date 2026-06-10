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
import { FeedIcon } from "~/modules/feed/feed-icon"
import type { MeAchievement, MeSettingItem, MeStat } from "~/modules/profile/me/me-parts"
import {
  BoltMotif,
  feedFrequencyLabel,
  feedHost,
  formatJoined,
  useMeAchievements,
  useMeSettings,
  useMeStats,
  useMeStreak,
} from "~/modules/profile/me/me-parts"
import { signOut } from "~/queries/auth"

export function ProfileScreen() {
  const { t } = useTranslation()
  const user = useWhoami()
  const navigate = useNavigate()
  const { present } = useModalStack()

  const feedCount = useFeedSubscriptionCount()
  const listCount = useListSubscriptionCount()
  const subscriptionIds = useAllFeedSubscriptionIds()

  const stats = useMeStats(feedCount, listCount)
  const achievements = useMeAchievements(feedCount)
  const settings = useMeSettings(user?.email)
  const streak = useMeStreak()

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-12">
        <EmptyStage
          eyebrow={t("words.login")}
          glyph={<i className="i-mgc-user-3-cute-re" />}
          title={t("mobile.profile.signed_out_title")}
          size="md"
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
    <div className="flex flex-col pb-6">
      {/* Branded cover */}
      <div className="relative z-0 h-24 overflow-hidden bg-folo">
        <BoltMotif
          size={150}
          color="rgba(26,18,7,0.12)"
          className="pointer-events-none absolute right-[18px] top-[-22px]"
        />
        <BoltMotif
          size={84}
          color="rgba(26,18,7,0.08)"
          className="pointer-events-none absolute left-[30px] top-[30px]"
        />
      </div>

      <div className="relative z-10 px-[18px] pb-3.5">
        <div className="mt-[-38px] flex items-end gap-3.5">
          {user.image ? (
            <img
              src={replaceImgUrlIfNeed(user.image)}
              alt=""
              className="size-20 shrink-0 rounded-[22px] border-4 border-background object-cover"
            />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-[22px] border-4 border-background bg-accent text-[34px] font-bold text-white">
              {initial}
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate("/settings/profile")}
            className="mb-1.5 flex h-[34px] items-center rounded-[10px] border border-border bg-background px-3.5 text-[13.5px] font-semibold text-text"
          >
            {t("me.actions.edit_profile")}
          </button>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-text">
          {user.name || user.handle}
        </h1>
        <div className="text-[13px] text-text-tertiary">
          {[user.handle ? `@${user.handle}` : null, formatJoined(user.createdAt, t)]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <p className="mt-2.5 text-sm leading-snug text-text-secondary">{t("me.bio")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 px-[18px] pt-1">
        {stats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      {/* Streak banner */}
      <div className="px-[18px] pt-4">
        <div className="relative flex items-center gap-3.5 overflow-hidden rounded-2xl bg-[#141414] px-[18px] py-4 text-white">
          <BoltMotif
            size={120}
            color="rgba(250,204,21,0.18)"
            className="pointer-events-none absolute -right-2.5 -top-5"
          />
          <i className="i-mgc-fire-cute-fi text-3xl text-accent" />
          <div className="relative">
            <div className="text-2xl font-bold tracking-[-0.02em]">
              {t("me.streak.title", { count: streak.current })}
            </div>
            <div className="text-[12.5px] text-white/70">
              {t("me.streak.subtitle", { count: streak.toNextBadge })}
            </div>
          </div>
        </div>
      </div>

      {/* Achievements rail */}
      <div className="pt-[22px]">
        <div className="px-[18px]">
          <MobHead title={t("me.achievements.title")} />
        </div>
        <div className="flex gap-3 overflow-x-auto px-[18px] pb-1 pt-3">
          {achievements.map((ach) => (
            <AchievementChip key={ach.id} ach={ach} />
          ))}
        </div>
      </div>

      {/* Subscriptions */}
      <div className="px-[18px] pt-[22px]">
        <MobHead title={t("me.subscriptions.title")} />
        <div className="border-border-secondary mt-2.5 overflow-hidden rounded-[14px] border bg-background">
          {subscriptionIds.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text-tertiary">
              {t("me.subscriptions.empty")}
            </div>
          ) : (
            subscriptionIds
              .slice(0, 4)
              .map((id, i) => <SubscriptionRow key={id} feedId={id} first={i === 0} />)
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="px-[18px] pt-[22px]">
        <MobHead title={t("me.settings.title")} />
        <div className="border-border-secondary mt-2.5 overflow-hidden rounded-[14px] border bg-background">
          {settings.slice(0, 5).map((item, i) => (
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
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[14px] border border-border bg-background py-3 text-sm font-semibold text-red transition-colors active:bg-fill-secondary"
        >
          <i className="i-mgc-exit-cute-re" />
          {t("mobile.profile.sign_out")}
        </button>
      </div>
    </div>
  )
}

function StatCard({ stat }: { stat: MeStat }) {
  return (
    <div className="border-border-secondary bg-secondary-system-background rounded-xl border px-1.5 py-3 text-center">
      <div
        className={cn(
          "text-[22px] font-bold tabular-nums tracking-[-0.02em]",
          stat.accent ? "text-accent" : "text-text",
        )}
      >
        {stat.value}
      </div>
      <div className="mt-0.5 text-[10.5px] font-semibold text-text-tertiary">{stat.label}</div>
    </div>
  )
}

function MobHead({ title }: { title: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[19px] font-bold tracking-[-0.015em] text-text">{title}</h2>
      <button
        type="button"
        className="flex items-center gap-0.5 text-[12.5px] font-semibold text-text-tertiary"
      >
        {t("me.actions.see_all_short")}
        <i className="i-mgc-right-cute-re text-[13px]" />
      </button>
    </div>
  )
}

function AchievementChip({ ach }: { ach: MeAchievement }) {
  const locked = !ach.unlocked
  return (
    <div
      className={cn(
        "border-border-secondary bg-secondary-system-background w-[100px] shrink-0 rounded-[14px] border px-3 py-3.5 text-center",
        locked && "opacity-60",
      )}
    >
      <div
        className="mx-auto flex size-11 items-center justify-center rounded-xl text-xl"
        style={locked ? undefined : { background: ach.color }}
      >
        <i
          className={cn(ach.icon, locked ? "text-text-quaternary" : "text-white")}
          style={locked ? undefined : { color: "#fff" }}
        />
      </div>
      <div className="mt-2 text-xs font-bold text-text">{ach.name}</div>
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
        "flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors active:bg-fill-secondary",
        !first && "border-border-secondary border-t",
      )}
    >
      <i className={cn(item.icon, "text-lg text-text-tertiary")} />
      <div className="min-w-0 flex-1 text-sm font-semibold text-text">{item.label}</div>
      <span className="truncate text-xs text-text-tertiary">{item.sub}</span>
      <i className="i-mgc-right-cute-re text-text-quaternary" />
    </button>
  )
}
