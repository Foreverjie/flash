import { useSubViewTitle } from "~/modules/app-layout/subview/hooks"
import { Explore } from "~/modules/explore"

export function Component() {
  useSubViewTitle("words.explore")

  return <Explore />
}
