import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { WEB_BUILD } from "@follow/shared/constants"
import type { FC } from "react"
import { useTranslation } from "react-i18next"

import { ReadabilityStatus, useEntryInReadabilityStatus } from "~/atoms/readability"
import { useShowSourceContent } from "~/atoms/source-content"

import { ReadabilityAutoToggleEffect } from "../ApplyEntryActions"

export const EntryNoContent: FC<{
  id: string
  url: string
}> = ({ id, url }) => {
  const status = useEntryInReadabilityStatus(id)
  const showSourceContent = useShowSourceContent()
  const { t } = useTranslation("app")

  if (status !== ReadabilityStatus.INITIAL && status !== ReadabilityStatus.FAILURE) {
    return null
  }
  return (
    <div className="center w-full px-6">
      {(WEB_BUILD || status === ReadabilityStatus.FAILURE) && (
        <EmptyStage
          eyebrow="No readable content"
          glyph={<i className="i-mgc-document-cute-re" />}
          title={t("entry_content.no_content")}
          body="Try opening the source in a browser, or switch on Readability to extract the article."
          size="md"
        />
      )}
      {!showSourceContent && url && <ReadabilityAutoToggleEffect url={url} id={id} />}
    </div>
  )
}
