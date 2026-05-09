import { Button } from "@follow/components/ui/button/index.js"
import { EmptyStage } from "@follow/components/ui/empty/index.js"
import type { FC } from "react"

import { attachOpenInEditor } from "~/lib/dev"

import type { AppErrorFallbackProps } from "../common/AppErrorBoundary"
import { FeedbackIssue } from "../common/ErrorElement"
import { parseError, useResetErrorWhenRouteChange } from "./helper"

const PageErrorFallback: FC<AppErrorFallbackProps> = (props) => {
  const { message, stack } = parseError(props.error)
  useResetErrorWhenRouteChange(props.resetError)
  return (
    <div className="pointer-events-auto flex w-full flex-col items-center justify-center rounded-md bg-background p-6">
      <div className="m-auto w-full max-w-prose">
        <EmptyStage
          eyebrow="Something broke"
          glyph={<i className="i-mgc-bug-cute-re text-red" />}
          title={message ?? "Unexpected error"}
          body={`${APP_NAME} hit a temporary problem. Try retrying, or reload the app.`}
          action={
            <div className="center flex gap-2">
              <Button onClick={() => props.resetError()} variant="primary">
                Retry
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                Reload
              </Button>
            </div>
          }
          size="md"
        />

        {import.meta.env.DEV && stack ? (
          <pre className="mt-6 max-h-48 cursor-text select-text overflow-auto whitespace-pre-line rounded-md bg-fill p-4 text-left font-mono text-xs text-red">
            {attachOpenInEditor(stack)}
          </pre>
        ) : null}

        <FeedbackIssue message={message!} stack={stack} error={props.error} />
      </div>
    </div>
  )
}

export default PageErrorFallback
