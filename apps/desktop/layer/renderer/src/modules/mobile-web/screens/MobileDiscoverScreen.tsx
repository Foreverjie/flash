import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@follow/components/ui/tabs/index.jsx"
import { CategoryMap, RSSHubCategories } from "@follow/constants"
import { useIsSubscribed } from "@follow/store/subscription/hooks"
import { cn, formatNumber } from "@follow/utils/utils"
import type { TrendingFeedItem } from "@follow-app/client-sdk"
import { useQuery } from "@tanstack/react-query"
import { createElement } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useSearchParams } from "react-router"

import { useUISettingKey } from "~/atoms/settings/ui"
import { AppErrorBoundary } from "~/components/common/AppErrorBoundary"
import { ErrorComponentType } from "~/components/errors/enum"
import { useFollow } from "~/hooks/biz/useFollow"
import { navigateEntry } from "~/hooks/biz/useNavigateEntry"
import { followClient } from "~/lib/api-client"
import { DiscoverForm } from "~/modules/discover/DiscoverForm"
import { DiscoverImport } from "~/modules/discover/DiscoverImport"
import { DiscoverInboxList } from "~/modules/discover/DiscoverInboxList"
import { DiscoverTransform } from "~/modules/discover/DiscoverTransform"
import { DiscoverUser } from "~/modules/discover/DiscoverUser"
import { FeedIcon } from "~/modules/feed/feed-icon"
import type { StarterPack } from "~/queries/packs"
import { usePacksQuery, usePackSubscribeMutation } from "~/queries/packs"

const tabs: { name: I18nKeys; value: string }[] = [
  { name: "words.search", value: "search" },
  { name: "words.rss", value: "rss" },
  { name: "words.rsshub", value: "rsshub" },
  { name: "words.inbox", value: "inbox" },
  { name: "words.user", value: "user" },
  { name: "words.transform", value: "transform" },
  { name: "words.import", value: "import" },
]

const TabComponent: Record<string, React.FC<{ type?: string; isInit?: boolean }>> = {
  import: DiscoverImport,
  inbox: DiscoverInboxList,
  user: DiscoverUser,
  default: DiscoverForm,
  transform: DiscoverTransform,
}

/** Bold, blank-canvas section heading: accent eyebrow + compact title. */
function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-[15px] font-semibold text-text">{title}</h2>
    </div>
  )
}

/**
 * Mobile-friendly Discover screen. Leads with the search affordances (same data
 * sources as the desktop variant) then storyboards the bold Discover surface:
 * full-color topic tiles, a trending leaderboard, and curated starter packs.
 */
export function MobileDiscoverScreen() {
  const [search, setSearch] = useSearchParams()
  const { t } = useTranslation()
  const activeType = search.get("type") || "search"

  return (
    <div className="flex flex-col gap-8 px-4 pb-10 pt-3">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          {t("mobile.discover.eyebrow")}
        </div>
        <h1 className="mt-1.5 text-balance text-[28px] font-semibold leading-[1.05] tracking-[-0.02em] text-text">
          {t("mobile.discover.title")}
        </h1>
        <p className="mt-2 text-sm leading-snug text-text-secondary">{t("mobile.discover.body")}</p>
      </header>

      <Tabs
        value={activeType}
        onValueChange={(val) =>
          setSearch(
            (s) => {
              s.set("type", val)
              s.delete("keyword")
              return new URLSearchParams(s)
            },
            { replace: true },
          )
        }
      >
        <div className="-mx-4 overflow-x-auto px-4">
          <TabsList
            className={cn(
              "inline-flex w-max items-center gap-1 rounded-full border border-border bg-background p-1",
            )}
          >
            {tabs.map((tab) => (
              <TabsTrigger key={tab.name} value={tab.value} className="rounded-full px-3 text-sm">
                {t(tab.name)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-4">
          {tabs.map((tab) => (
            <TabsContent key={tab.name} value={tab.value} className="mt-0">
              <div className={tab.value === "inbox" ? "" : "flex flex-col"}>
                {createElement(TabComponent[tab.value] || TabComponent.default!, {
                  type: tab.value,
                })}
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>

      <section>
        <SectionHead eyebrow={t("words.categories")} title={t("mobile.discover.topics_subtitle")} />
        <TopicTiles />
      </section>

      <section>
        <SectionHead eyebrow={t("words.trending")} title={t("mobile.discover.trending_subtitle")} />
        <AppErrorBoundary errorType={ErrorComponentType.RSSHubDiscoverError}>
          <TrendingLeaderboard />
        </AppErrorBoundary>
      </section>

      <section>
        <SectionHead
          eyebrow={t("mobile.discover.packs_eyebrow")}
          title={t("mobile.discover.packs_subtitle")}
        />
        <StarterPacks />
      </section>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Topics — full-color category tiles (real RSSHub categories)
// ──────────────────────────────────────────────────────────────────────────
function TopicTiles() {
  const { t } = useTranslation("common")
  const categories = RSSHubCategories.filter((cat) => cat !== "all")

  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5">
      {categories.map((cat) => {
        const meta = CategoryMap[cat]
        return (
          <Link
            key={cat}
            to={`/discover/category/${cat}`}
            className="relative flex h-[84px] flex-col justify-end overflow-hidden rounded-2xl p-3 text-white shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
            style={{
              backgroundImage: `linear-gradient(-135deg, ${meta?.color}D9, ${meta?.color})`,
            }}
          >
            <div className="absolute -right-3 -top-3 text-[44px] opacity-25">{meta?.emoji}</div>
            <div className="relative text-[15px] font-bold leading-tight drop-shadow-sm">
              {t(`discover.category.${cat}`)}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Trending — compact ranked leaderboard (real trending feeds)
// ──────────────────────────────────────────────────────────────────────────
function TrendingLeaderboard() {
  const lang = useUISettingKey("discoverLanguage")
  const { data, isLoading } = useQuery({
    queryKey: ["trending", "mobile-leaderboard", lang],
    queryFn: () =>
      followClient.api.trending.getFeeds({
        language: lang === "all" ? undefined : lang,
        limit: 8,
      }),
    meta: { persist: true },
  })

  if (isLoading) {
    return (
      <div className="mt-2 flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="my-1.5 h-[52px] w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="mt-1 flex flex-col">
      {data?.data?.map((item, index) => (
        <TrendingRow key={item.feed?.id || index} item={item} rank={index + 1} />
      ))}
    </div>
  )
}

function TrendingRow({ item, rank }: { item: TrendingFeedItem; rank: number }) {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const location = useLocation()
  const follow = useFollow()
  const isSubscribed = useIsSubscribed(item.feed?.id || "")
  const followers = item.analytics?.subscriptionCount

  return (
    <div className="border-border-secondary flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <div
        className={cn(
          "w-5 shrink-0 text-center text-base font-bold tabular-nums",
          rank <= 3 ? "text-accent" : "text-text-quaternary",
        )}
      >
        {rank}
      </div>

      <button
        type="button"
        disabled={!item.feed?.id}
        onClick={() => {
          if (!item.feed?.id) return
          navigateEntry({
            feedId: item.feed.id,
            view: item.analytics?.view ?? 0,
            backPath: `${location.pathname}${location.search}`,
          })
        }}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <FeedIcon
          target={item.feed ? { ...item.feed, type: "feed" } : null}
          size={36}
          className="shrink-0"
          noMargin
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-text">{item.feed?.title}</div>
          {!!followers && (
            <div className="mt-0.5 text-xs text-text-tertiary">
              {formatNumber(followers)} {tCommon("feed.follower", { count: followers })}
            </div>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={() =>
          follow({
            isList: false,
            id: item.feed?.id,
            url: item.feed?.url,
          })
        }
        className={cn(
          "h-7 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors",
          isSubscribed
            ? "bg-brand-accent text-white"
            : "border border-border bg-background text-text active:bg-fill",
        )}
      >
        {isSubscribed ? t("feed.actions.followed") : t("feed.actions.follow")}
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Starter packs — curated horizontal carousel (GET /packs, design fallback)
// ──────────────────────────────────────────────────────────────────────────
const FALLBACK_PACKS: StarterPack[] = [
  {
    id: "design-greats",
    slug: "design-greats",
    name: "Design greats",
    description: "The blogs every product designer keeps in their reader.",
    color: "#EC407A",
    feedCount: 14,
    previews: ["R", "S", "N", "D"].map((m) => ({
      feedId: m,
      title: m,
      image: null,
      siteUrl: null,
    })),
  },
  {
    id: "ai-frontier",
    slug: "ai-frontier",
    name: "AI frontier",
    description: "Labs, researchers and analysts worth following weekly.",
    color: "#7E57C2",
    feedCount: 18,
    previews: ["A", "O", "G", "D"].map((m) => ({
      feedId: m,
      title: m,
      image: null,
      siteUrl: null,
    })),
  },
  {
    id: "indie-web",
    slug: "indie-web",
    name: "The indie web",
    description: "Personal sites and small blogs with big ideas.",
    color: "#66BB6A",
    feedCount: 22,
    previews: ["R", "M", "T", "K"].map((m) => ({
      feedId: m,
      title: m,
      image: null,
      siteUrl: null,
    })),
  },
]

function StarterPacks() {
  const { data } = usePacksQuery()
  const packs = data && data.length > 0 ? data : FALLBACK_PACKS
  const isLive = Boolean(data && data.length > 0)

  return (
    <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1.5">
      {packs.map((pack) => (
        <StarterPackCard key={pack.id} pack={pack} isLive={isLive} />
      ))}
    </div>
  )
}

function StarterPackCard({ pack, isLive }: { pack: StarterPack; isLive: boolean }) {
  const { t } = useTranslation()
  const subscribe = usePackSubscribeMutation()
  const followed = subscribe.isSuccess

  return (
    <div className="border-border-secondary flex w-[220px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-background shadow-[var(--shadow-card)]">
      <div className="flex h-[72px] items-end p-3" style={{ backgroundColor: pack.color ?? "" }}>
        <div className="flex">
          {pack.previews.map((m, i) => (
            <div
              key={m.feedId}
              className="flex size-8 items-center justify-center overflow-hidden rounded-full border-2 border-white text-xs font-bold"
              style={{
                backgroundColor: "#fff",
                color: pack.color ?? "",
                marginLeft: i ? -8 : 0,
              }}
            >
              {m.image ? (
                <img src={m.image} alt="" className="size-full object-cover" />
              ) : (
                (m.title || "?").slice(0, 1).toUpperCase()
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="text-[15px] font-bold text-text">{pack.name}</div>
        <div className="mt-1 line-clamp-2 min-h-[34px] text-[13px] leading-snug text-text-tertiary">
          {pack.description}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary">
            {t("mobile.discover.pack_feed_count", { count: pack.feedCount })}
          </span>
          <button
            type="button"
            disabled={!isLive || subscribe.isPending || followed}
            onClick={() => subscribe.mutate(pack.slug)}
            className={cn(
              "h-7 rounded-full px-3.5 text-xs font-bold transition-colors",
              followed
                ? "bg-brand-accent text-white"
                : "bg-fill text-text active:bg-fill-secondary",
            )}
          >
            {followed ? t("feed.actions.followed") : t("mobile.discover.follow_all")}
          </button>
        </div>
      </div>
    </div>
  )
}
