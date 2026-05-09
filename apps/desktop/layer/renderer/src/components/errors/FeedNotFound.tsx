import { Logo } from "@follow/components/icons/logo.jsx"
import { Button } from "@follow/components/ui/button/index.js"
import { EmptyStage } from "@follow/components/ui/empty/index.js"
import type { FC } from "react"
import { useNavigate } from "react-router"

import { CustomSafeError } from "../../errors/CustomSafeError"
import type { AppErrorFallbackProps } from "../common/AppErrorBoundary"
import { useResetErrorWhenRouteChange } from "./helper"

const FeedNotFoundErrorFallback: FC<AppErrorFallbackProps> = ({ resetError, error }) => {
  if (!(error instanceof FeedNotFound)) {
    throw error
  }

  useResetErrorWhenRouteChange(resetError)
  const navigate = useNavigate()
  return (
    <div className="flex w-full flex-col items-center justify-center rounded-md bg-background p-6">
      <EmptyStage
        eyebrow="Feed not found"
        glyph={<Logo className="size-14 rounded-2xl opacity-90" />}
        title="No feed at that ID"
        body="Check the URL and try again, or head back to your timeline."
        action={
          <Button
            variant="outline"
            onClick={() => {
              navigate("/")
              setTimeout(() => {
                resetError()
              }, 100)
            }}
          >
            Back to home
          </Button>
        }
        size="md"
      />
    </div>
  )
}
export default FeedNotFoundErrorFallback

export class FeedNotFound extends CustomSafeError {
  constructor() {
    super("Feed 404")
  }
}
