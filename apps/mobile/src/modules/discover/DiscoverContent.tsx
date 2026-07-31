import { View } from "react-native"

import { Category } from "@/src/modules/discover/Category"
import { Packs } from "@/src/modules/discover/Packs"
import { Trending } from "@/src/modules/discover/Trending"

export function DiscoverContent() {
  return (
    <View className="pb-6">
      <Trending itemClassName="px-6" />
      <Category />
      <Packs />
    </View>
  )
}
