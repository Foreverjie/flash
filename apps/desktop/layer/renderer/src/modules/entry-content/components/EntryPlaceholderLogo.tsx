import { Logo } from "@follow/components/icons/logo.jsx"
import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { stopPropagation } from "@follow/utils/dom"

import { useFeedHeaderTitle } from "~/store/feed/hooks"

export const EntryPlaceholderLogo = () => {
  const title = useFeedHeaderTitle()

  return (
    <div
      data-hide-in-print
      onContextMenu={stopPropagation}
      className="flex w-full min-w-0 flex-col items-center justify-center px-12 pb-6 duration-500"
    >
      <EmptyStage
        eyebrow="Flash · Reader"
        glyph={<Logo className="size-14 rounded-2xl opacity-90" />}
        title="Pick an entry to start reading"
        body={title || "Your timeline lives on the left. Select something to dive in."}
        size="lg"
      />
    </div>
  )
}
