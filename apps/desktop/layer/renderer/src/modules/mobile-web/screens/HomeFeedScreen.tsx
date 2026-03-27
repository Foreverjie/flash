import { useWhoami } from "@follow/store/user/hooks"

export function HomeFeedScreen() {
  const user = useWhoami()

  if (!user) {
    return <PublicHomeFeed />
  }

  return <AuthenticatedHomeFeed />
}

function PublicHomeFeed() {
  return (
    <div className="flex flex-col gap-3 p-0">
      {/* TODO: Connect to public timeline API and render cards */}
      <div className="flex items-center justify-center py-20 text-text-tertiary">
        Public feed coming soon
      </div>
    </div>
  )
}

function AuthenticatedHomeFeed() {
  return (
    <div className="flex flex-col gap-3 p-0">
      {/* TODO: Connect to entry store via useEntriesByView and render type-aware cards */}
      <div className="flex items-center justify-center py-20 text-text-tertiary">
        Your feed is loading...
      </div>
    </div>
  )
}
