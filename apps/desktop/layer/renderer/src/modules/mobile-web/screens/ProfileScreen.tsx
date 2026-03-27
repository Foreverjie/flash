import { useWhoami } from "@follow/store/user/hooks"

import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { replaceImgUrlIfNeed } from "~/lib/img-proxy"
import { LoginModalContent } from "~/modules/auth/LoginModalContent"
import { signOut } from "~/queries/auth"

export function ProfileScreen() {
  const user = useWhoami()
  const { present } = useModalStack()

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <i className="i-mgc-user-3-cute-re text-4xl text-text-tertiary" />
        <p className="mb-2 text-text-tertiary">Sign in to access your profile</p>
        <button
          type="button"
          className="rounded-full bg-brand-accent px-6 py-2.5 text-sm font-semibold text-white"
          onClick={() => {
            present({
              CustomModalComponent: PlainModal,
              title: "Login",
              id: "login",
              content: () => <LoginModalContent runtime="browser" />,
              clickOutsideToDismiss: true,
            })
          }}
        >
          Sign In
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 px-4 py-6">
        <img
          src={replaceImgUrlIfNeed(user.image || undefined)}
          alt=""
          className="size-16 rounded-full object-cover"
        />
        <div className="text-center">
          <div className="text-lg font-semibold text-text">{user.name}</div>
          {user.handle && <div className="text-sm text-text-secondary">@{user.handle}</div>}
        </div>
      </div>

      {/* Menu items */}
      <div className="bg-system-background mx-4 overflow-hidden rounded-2xl">
        <ProfileMenuItem icon="i-mgc-settings-7-cute-re" label="Settings" />
        <ProfileMenuItem icon="i-mgc-download-cute-re" label="Import / Export OPML" />
        <ProfileMenuItem icon="i-mgc-information-cute-re" label="About" />
      </div>

      <div className="bg-system-background mx-4 mt-4 overflow-hidden rounded-2xl">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm text-red"
          onClick={() => signOut()}
        >
          <i className="i-mgc-exit-cute-re" />
          Sign Out
        </button>
      </div>
    </div>
  )
}

function ProfileMenuItem({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm text-text last:border-b-0"
    >
      <i className={`${icon} text-lg text-text-secondary`} />
      {label}
      <i className="i-mgc-right-cute-re ml-auto text-text-tertiary" />
    </button>
  )
}
