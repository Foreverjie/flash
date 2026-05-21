import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { stopPropagation } from "@follow/utils/dom"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router"

import { useModalStack } from "~/components/ui/modal/stacked/hooks"

import { SimpleDiscoverModal } from "../SimpleDiscoverModal"

export const EmptyFeedList = memo(({ onClick }: { onClick?: (e: React.MouseEvent) => void }) => {
  const { t } = useTranslation()
  const location = useLocation()
  const isOnDiscoverPage = location.pathname === "/discover"
  const { present } = useModalStack()

  const handleClick = (e: React.MouseEvent) => {
    stopPropagation(e)
    onClick?.(e)

    if (!isOnDiscoverPage) {
      present({
        title: t("words.discover"),
        content: ({ dismiss }) => <SimpleDiscoverModal dismiss={dismiss} />,
        clickOutsideToDismiss: true,
      })
    }
  }

  return (
    <div className="mt-12 flex flex-1 cursor-menu items-center px-4" onClick={handleClick}>
      {isOnDiscoverPage ? (
        <EmptyStage
          eyebrow={t("sidebar.empty.on_discover_eyebrow")}
          glyph={<i className="i-mgc-arrow-right-up-cute-re" />}
          title={t("sidebar.already_on_discover_page")}
          size="sm"
        />
      ) : (
        <EmptyStage
          eyebrow={t("sidebar.empty.eyebrow")}
          glyph={<i className="i-mgc-add-cute-re" />}
          title={t("sidebar.add_more_feeds")}
          body={t("sidebar.empty.body")}
          size="sm"
        />
      )}
    </div>
  )
})
EmptyFeedList.displayName = "EmptyFeedList"
