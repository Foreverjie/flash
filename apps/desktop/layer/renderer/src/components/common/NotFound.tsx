import { Logo } from "@follow/components/icons/logo.jsx"
import { Button } from "@follow/components/ui/button/index.js"
import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { ELECTRON_BUILD } from "@follow/shared/constants"
import { captureException } from "@sentry/react"
import { useEffect } from "react"
import type { Location } from "react-router"
import { Navigate, useLocation, useNavigate } from "react-router"

import { useSyncTheme } from "~/hooks/common"
import { removeAppSkeleton } from "~/lib/app"

import { PoweredByFooter } from "./PoweredByFooter"

class AccessNotFoundError extends Error {
  constructor(
    message: string,
    public path: string,
    public location: Location<any>,
  ) {
    super(message)
    this.name = "AccessNotFoundError"
  }

  override toString() {
    return `${this.name}: ${this.message} at ${this.path}`
  }
}

export const NotFound = () => {
  const location = useLocation()
  useSyncTheme()

  useEffect(() => {
    if (!ELECTRON_BUILD) return
    captureException(
      new AccessNotFoundError(
        "Electron app got to a 404 page, this should not happen",
        location.pathname,
        location,
      ),
    )
  }, [location])

  useEffect(() => {
    removeAppSkeleton()
  }, [])

  const navigate = useNavigate()

  if (location.pathname.endsWith("/index.html")) {
    return <Navigate to="/" />
  }

  return (
    <div className="flex size-full flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-6">
        <EmptyStage
          eyebrow="Lost"
          glyph={<Logo className="size-14 rounded-2xl" />}
          title="A desert of knowledge"
          body={
            <>
              There's nothing at <code className="font-mono text-[12px]">{location.pathname}</code>.
              Head back and pick a different path.
            </>
          }
          action={
            <Button variant="primary" onClick={() => navigate("/")}>
              Back to home
            </Button>
          }
          size="lg"
        />
      </main>
      <PoweredByFooter className="center flex gap-2 py-8" />
    </div>
  )
}
