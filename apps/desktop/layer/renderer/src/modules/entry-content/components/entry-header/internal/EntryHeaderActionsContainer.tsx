import clsx from "clsx"
import { memo } from "react"
import { useTranslation } from "react-i18next"

import { toggleShowAISummaryOnce } from "~/atoms/ai-summary"
import { useRouteParams } from "~/hooks/biz/useRouteParams"

import { EntryHeaderActions } from "../../../actions/header-actions"
import { MoreActions } from "../../../actions/more-actions"
import { useEntryHeaderContext } from "./context"

function EntryHeaderActionsContainerImpl({ isSmallWidth }: { isSmallWidth?: boolean }) {
  const { entryId } = useEntryHeaderContext()
  const { view } = useRouteParams()

  return (
    <div className={clsx("relative flex shrink-0 items-center justify-end gap-2")}>
      {!isSmallWidth && <SummarizeButton />}
      {!isSmallWidth && <EntryHeaderActions entryId={entryId} view={view} />}
      <MoreActions entryId={entryId} view={view} showMainAction={isSmallWidth} />
    </div>
  )
}

/**
 * Accent pill that surfaces the AI summary, which otherwise only exists behind
 * the overflow menu. Drives the same atom as COMMAND_ID.entry.toggleAISummary.
 */
const SummarizeButton = () => {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={toggleShowAISummaryOnce}
      className="flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-accent/40 bg-accent/[0.16] px-2.5 text-xs font-semibold text-accent-ink transition-all hover:-translate-y-px hover:border-accent hover:bg-accent hover:text-accent-fg"
    >
      <i className="i-mgc-ai-cute-re size-3.5" />
      {t("entry_actions.toggle_ai_summary")}
    </button>
  )
}

export const EntryHeaderActionsContainer = memo(EntryHeaderActionsContainerImpl)
