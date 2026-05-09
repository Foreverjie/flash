import { Logo } from "@follow/components/icons/logo.jsx"
import { Button } from "@follow/components/ui/button/index.js"
import { EmptyStage } from "@follow/components/ui/empty/index.js"
import type { FC } from "react"
import { useNavigate } from "react-router"

import { CustomSafeError } from "../../errors/CustomSafeError"
import type { AppErrorFallbackProps } from "../common/AppErrorBoundary"
import { useResetErrorWhenRouteChange } from "./helper"

const EntryNotFoundErrorFallback: FC<AppErrorFallbackProps> = ({ resetError, error }) => {
  if (!(error instanceof EntryNotFound)) {
    throw error
  }

  useResetErrorWhenRouteChange(resetError)
  const navigate = useNavigate()
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center rounded-md bg-background p-6">
      <EmptyStage
        eyebrow="Entry not found"
        glyph={<Logo className="size-14 rounded-2xl opacity-90" />}
        title="This entry has gone missing"
        body="It may have been removed, or the URL is incorrect."
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
export default EntryNotFoundErrorFallback

export class EntryNotFound extends CustomSafeError {
  constructor() {
    super("Entry 404")
  }
}
