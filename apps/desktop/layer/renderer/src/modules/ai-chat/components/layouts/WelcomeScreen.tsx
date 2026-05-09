import { Logo } from "@follow/components/icons/logo.jsx"
import { ScrollArea } from "@follow/components/ui/scroll-area/ScrollArea.js"
import { clsx } from "@follow/utils"
import { AnimatePresence, m } from "motion/react"
import { useTranslation } from "react-i18next"

import { AISpline } from "~/modules/ai-chat/components/3d-models/AISpline"

import { useAttachScrollBeyond } from "../../hooks/useAttachScrollBeyond"
import { useMainEntryId } from "../../hooks/useMainEntryId"
import { DefaultWelcomeContent, EntryWelcomeContent } from "../welcome"

interface WelcomeScreenProps {
  centerInputOnEmpty?: boolean
}

export const WelcomeScreen = ({ centerInputOnEmpty }: WelcomeScreenProps) => {
  const { t } = useTranslation("ai")
  const mainEntryId = useMainEntryId()
  const hasEntryContext = Boolean(mainEntryId)

  const { handleScroll } = useAttachScrollBeyond()

  return (
    <ScrollArea
      rootClassName="flex min-h-0 flex-1"
      viewportClassName="px-6 pt-24 flex min-h-0 grow"
      scrollbarClassName="mb-40 mt-12"
      flex
      onScroll={handleScroll}
    >
      <div className="mx-auto flex w-full flex-1 flex-col justify-center space-y-8 pb-52">
        <DefaultWelcomeHeader
          description={
            hasEntryContext ? t("welcome_description_contextual") : t("welcome_description")
          }
        />

        <div
          className={clsx(
            "relative flex items-start justify-center",
            centerInputOnEmpty && "absolute bottom-0 translate-y-40",
          )}
        >
          <AnimatePresence mode="wait">
            {hasEntryContext && mainEntryId ? (
              <EntryWelcomeContent key="entry-welcome" entryId={mainEntryId} />
            ) : (
              <DefaultWelcomeContent key="default-welcome" />
            )}
          </AnimatePresence>
        </div>
      </div>
    </ScrollArea>
  )
}

const DefaultWelcomeHeader = ({ description }: { description: string }) => (
  <m.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center gap-4 text-center"
    data-testid="welcome-screen-header"
  >
    <div className="center">
      <AISpline />
    </div>
    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
      Flash · AI
    </div>
    <h1 className="m-0 flex items-center justify-center gap-2 text-[28px] font-semibold tracking-[-0.02em] text-text">
      <Logo className="size-9 rounded-xl" />
      Ask Flash
    </h1>
    <p className="m-0 max-w-md text-balance text-sm leading-normal text-text-secondary">
      {description}
    </p>
  </m.div>
)
