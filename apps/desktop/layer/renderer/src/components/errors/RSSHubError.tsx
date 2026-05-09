import { EmptyStage } from "@follow/components/ui/empty/index.js"
import type { FC } from "react"

import { attachOpenInEditor } from "~/lib/dev"

import type { AppErrorFallbackProps } from "../common/AppErrorBoundary"
import { FeedbackIssue } from "../common/ErrorElement"
import { parseError } from "./helper"

const RSSHubErrorFallback: FC<AppErrorFallbackProps> = (props) => {
  const { message, stack } = parseError(props.error)

  return (
    <div className="flex w-full flex-col items-center justify-center px-6 py-8">
      <EmptyStage
        eyebrow="RSSHub unavailable"
        glyph={<i className="i-mgc-bug-cute-re text-red" />}
        title="RSSHub has a temporary problem"
        body={message ?? "Please contact our team if it persists."}
        size="md"
      />
      <div className="mt-6 w-full max-w-prose">
        {import.meta.env.DEV && stack ? (
          <pre className="max-h-48 cursor-text overflow-auto whitespace-pre-line rounded-md bg-fill p-4 text-left font-mono text-xs text-red">
            {attachOpenInEditor(stack)}
          </pre>
        ) : null}
        <FeedbackIssue message={message!} stack={stack} error={props.error} />
      </div>
    </div>
  )
}
export default RSSHubErrorFallback
