import { useAtom } from "jotai"
import { AnimatePresence, m } from "motion/react"

import { mobileDrawerOpenAtom } from "./atoms"

export function MobileSubscriptionDrawer() {
  const [isOpen, setIsOpen] = useAtom(mobileDrawerOpenAtom)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black"
            onClick={() => setIsOpen(false)}
          />
          {/* Drawer panel */}
          <m.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-system-background fixed inset-y-0 left-0 z-50 w-4/5 max-w-[320px] overflow-y-auto pt-safe-area-top"
          >
            <div className="p-4">
              <h2 className="mb-4 text-lg font-semibold text-text">Subscriptions</h2>
              {/* TODO: Reuse subscription list component from ~/modules/app-layout/subscription-column/ */}
              {/* The existing SubscriptionList has desktop-specific logic (DnD via @dnd-kit/core, */}
              {/* multi-select via react-selecto, keyboard focus scope, etc.). */}
              {/* Wire the actual list in Task 13 (Data Wiring). */}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
