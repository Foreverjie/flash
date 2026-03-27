import { useWhoami } from "@follow/store/user/hooks"

export function NotificationsScreen() {
  const user = useWhoami()

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <i className="i-mgc-notification-cute-re text-4xl text-text-tertiary" />
        <p className="text-text-tertiary">Sign in to see your notifications</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <i className="i-mgc-notification-cute-re text-4xl text-text-tertiary" />
      <p className="text-text-tertiary">No notifications yet</p>
    </div>
  )
}
