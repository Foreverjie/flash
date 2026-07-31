import { useMobile } from "@follow/components/hooks/useMobile.js"
import { createElement } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"

import { useSubViewTitle } from "~/modules/app-layout/subview/hooks"
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
  BoldSection,
  BoltMotif,
  QuickChip,
  StarterPackGrid,
  TopicTiles,
  TrendingLeaderboard,
} from "~/modules/discover/DiscoverSurface"
import { DiscoverTransform } from "~/modules/discover/DiscoverTransform"
import { DiscoverUser } from "~/modules/discover/DiscoverUser"
import { MobileDiscoverScreen } from "~/modules/mobile-web/screens/MobileDiscoverScreen"
import { usePacksQuery } from "~/queries/packs"
import { useTopicsQuery } from "~/queries/topics"

const PanelComponent: Record<string, React.FC<{ type?: string; isInit?: boolean }>> = {
  import: DiscoverImport,
  inbox: DiscoverInboxList,
  user: DiscoverUser,
  transform: DiscoverTransform,
  default: DiscoverForm,
}

export function Component() {
  const { t } = useTranslation()
  const [search, setSearch] = useSearchParams()
  useSubViewTitle("words.discover")
  const isMobile = useMobile()

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

  if (isMobile) {
    return <MobileDiscoverScreen />
  }

  const isSearching = type === "search" && !!keyword
  const panelType = type === "search" ? null : type

  return (
    <div className="flex size-full flex-col">
      {/* Hero — pulled up under the floating subview header */}
      <div className="relative -mt-24 w-full overflow-hidden border-b border-border bg-material-opaque pb-10 pt-32">
        <BoltMotif className="pointer-events-none absolute -right-16 -top-32 size-[420px] text-accent/50" />

        <div className="relative mx-auto w-full max-w-[1040px] px-12">
          <h1 className="m-0 max-w-[720px] text-balance text-[52px] font-semibold leading-[1.02] tracking-[-0.03em] text-text">
            {t("discover.hero_title")}
          </h1>
          <p className="m-0 mt-3.5 max-w-[540px] text-[17px] leading-normal text-text-secondary">
            {t("discover.hero_body")}
          </p>

          <div className="mt-6 max-w-screen-sm">
            <DiscoverSearchField
              big
              value={keyword}
              onSubmit={(value) => patchSearch({ type: "search", keyword: value })}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            {DISCOVER_QUICK_CHIPS.map((chip) => (
              <QuickChip
                key={chip.type}
                icon={chip.icon}
                label={t(chip.label)}
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
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1040px] px-12 pb-20">
        {panelType ? (
          <div className={panelType === "inbox" ? "mt-8" : "mt-8 flex flex-col items-center"}>
            {createElement(PanelComponent[panelType] || PanelComponent.default!, {
              type: panelType,
            })}
          </div>
        ) : isSearching ? (
          <div className="mt-8">
            <DiscoverResultTabs
              target={target}
              onChange={(value) => patchSearch({ target: value })}
            />
            <DiscoverSearchResults keyword={keyword} target={target} />
          </div>
        ) : (
          <>
            <section className="mt-11">
              <BoldSection
                kicker={t("discover.kicker.hot")}
                title={t("discover.section.trending")}
              />
              <TrendingLeaderboard limit={8} columns={2} />
            </section>

            <TopicsSection />

            <PacksSection />
          </>
        )}
      </div>
    </div>
  )
}

function TopicsSection() {
  const { t } = useTranslation()
  const { data, isLoading } = useTopicsQuery()

  if (!isLoading && (!data || data.length === 0)) return null

  return (
    <section className="mt-[52px]">
      <BoldSection
        kicker={t("discover.kicker.browse")}
        title={t("mobile.discover.topics_subtitle")}
      />
      <TopicTiles columns={4} tall />
    </section>
  )
}

function PacksSection() {
  const { t } = useTranslation()
  const { data } = usePacksQuery()

  if (!data || data.length === 0) return null

  return (
    <section className="mt-[52px]">
      <BoldSection
        kicker={t("discover.kicker.curated")}
        title={t("mobile.discover.packs_subtitle")}
      />
      <StarterPackGrid columns={3} />
    </section>
  )
}
