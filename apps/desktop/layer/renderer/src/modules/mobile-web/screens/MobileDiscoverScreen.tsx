import { Tabs, TabsContent, TabsList, TabsTrigger } from "@follow/components/ui/tabs/index.jsx"
import { cn } from "@follow/utils/utils"
import { createElement } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"

import { AppErrorBoundary } from "~/components/common/AppErrorBoundary"
import { ErrorComponentType } from "~/components/errors/enum"
import { DiscoverForm } from "~/modules/discover/DiscoverForm"
import { DiscoverImport } from "~/modules/discover/DiscoverImport"
import { DiscoverInboxList } from "~/modules/discover/DiscoverInboxList"
import { DiscoverTransform } from "~/modules/discover/DiscoverTransform"
import { DiscoverUser } from "~/modules/discover/DiscoverUser"
import { Recommendations } from "~/modules/discover/recommendations"
import { Trending } from "~/modules/trending"

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

/**
 * Mobile-friendly Discover screen. Same data sources as the desktop variant
 * (DiscoverForm, Trending, Recommendations) but with compact typography and
 * a horizontally scrollable tab strip instead of the centered Stage layout.
 */
export function MobileDiscoverScreen() {
  const [search, setSearch] = useSearchParams()
  const { t } = useTranslation()
  const activeType = search.get("type") || "search"

  return (
    <div className="flex flex-col gap-6 px-4 pb-10 pt-3">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          {t("mobile.discover.eyebrow")}
        </div>
        <h1 className="mt-1.5 text-balance text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text">
          {t("mobile.discover.title")}
        </h1>
        <p className="mt-1.5 text-sm leading-snug text-text-secondary">
          {t("mobile.discover.body")}
        </p>
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

      <section className="mt-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          {t("words.trending")}
        </div>
        <h2 className="mb-3 mt-1.5 text-[15px] font-semibold text-text">
          {t("mobile.discover.trending_subtitle")}
        </h2>
        <Trending center={false} />
      </section>

      <section className="mt-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">
          {t("words.for_you")}
        </div>
        <h2 className="mb-3 mt-1.5 text-[15px] font-semibold text-text">
          {t("mobile.discover.recommendations_subtitle")}
        </h2>
        <AppErrorBoundary errorType={ErrorComponentType.RSSHubDiscoverError}>
          <Recommendations />
        </AppErrorBoundary>
      </section>
    </div>
  )
}
