import { createElement } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"

import { AppErrorBoundary } from "~/components/common/AppErrorBoundary"
import { ErrorComponentType } from "~/components/errors/enum"
import { DISCOVER_QUICK_CHIPS } from "~/modules/discover/chips"
import { DiscoverForm } from "~/modules/discover/DiscoverForm"
import { DiscoverImport } from "~/modules/discover/DiscoverImport"
import { DiscoverInboxList } from "~/modules/discover/DiscoverInboxList"
import type { DiscoverSearchTarget } from "~/modules/discover/DiscoverSearch"
import {
  DiscoverResultTabs,
  DiscoverSearchField,
  DiscoverSearchResults,
} from "~/modules/discover/DiscoverSearch"
import {
  MobileSectionHead,
  QuickChip,
  StarterPackGrid,
  TopicTiles,
  TrendingLeaderboard,
} from "~/modules/discover/DiscoverSurface"
import { DiscoverTransform } from "~/modules/discover/DiscoverTransform"
import { DiscoverUser } from "~/modules/discover/DiscoverUser"
import { usePacksQuery } from "~/queries/packs"
import { useTopicsQuery } from "~/queries/topics"

const PanelComponent: Record<string, React.FC<{ type?: string; isInit?: boolean }>> = {
  import: DiscoverImport,
  inbox: DiscoverInboxList,
  user: DiscoverUser,
  transform: DiscoverTransform,
  default: DiscoverForm,
}

/**
 * Mobile-friendly Discover screen. Leads with a lean search header plus chip
 * shortcuts into the other add-feed flows, then storyboards the bold Discover
 * surface: a trending leaderboard, full-colour topic tiles and starter packs.
 */
export function MobileDiscoverScreen() {
  const { t } = useTranslation()
  const [search, setSearch] = useSearchParams()

  const type = search.get("type") || "search"
  const keyword = search.get("keyword") || ""
  const target = (search.get("target") || "feeds") as DiscoverSearchTarget

  const patchSearch = (patch: Record<string, string | null>) => {
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(patch)) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  const panelType = type === "search" ? null : type
  const isSearching = type === "search" && !!keyword

  return (
    <div className="flex flex-col pb-10">
      <header className="border-b border-border-secondary px-4 pb-3.5 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <DiscoverSearchField
          value={keyword}
          onSubmit={(value) => patchSearch({ type: "search", keyword: value })}
        />
        <div className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-0.5">
          {DISCOVER_QUICK_CHIPS.map((chip) => (
            <QuickChip
              key={chip.type}
              icon={chip.icon}
              label={t(chip.shortLabel)}
              active={panelType === chip.type}
              onClick={() =>
                patchSearch(
                  panelType === chip.type
                    ? { type: "search", keyword: null }
                    : { type: chip.type, keyword: null },
                )
              }
            />
          ))}
        </div>
      </header>

      {panelType ? (
        <div className={panelType === "inbox" ? "px-4 pt-4" : "flex flex-col px-4 pt-4"}>
          {createElement(PanelComponent[panelType] || PanelComponent.default!, {
            type: panelType,
          })}
        </div>
      ) : isSearching ? (
        <div className="px-4 pt-4">
          <DiscoverResultTabs
            target={target}
            onChange={(value) => patchSearch({ target: value })}
          />
          <DiscoverSearchResults keyword={keyword} target={target} />
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-4 pt-4">
          <section>
            <MobileSectionHead title={t("discover.section.trending")} />
            <AppErrorBoundary errorType={ErrorComponentType.RSSHubDiscoverError}>
              <div className="mt-1">
                <TrendingLeaderboard limit={8} />
              </div>
            </AppErrorBoundary>
          </section>

          <TopicsSection />

          <PacksSection />
        </div>
      )}
    </div>
  )
}

function TopicsSection() {
  const { t } = useTranslation()
  const { data, isLoading } = useTopicsQuery()

  if (!isLoading && (!data || data.length === 0)) return null

  return (
    <section>
      <MobileSectionHead title={t("mobile.discover.topics_subtitle")} />
      <div className="mt-3">
        <TopicTiles columns={2} />
      </div>
    </section>
  )
}

function PacksSection() {
  const { t } = useTranslation()
  const { data } = usePacksQuery()

  if (!data || data.length === 0) return null

  return (
    <section>
      <MobileSectionHead title={t("mobile.discover.packs_subtitle")} />
      <div className="mt-3">
        <StarterPackGrid />
      </div>
    </section>
  )
}
