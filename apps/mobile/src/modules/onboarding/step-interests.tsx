import { useTranslation } from "react-i18next"
import { View } from "react-native"
import Animated, { Easing, FadeInDown } from "react-native-reanimated"

import { Search3CuteReIcon } from "@/src/icons/search_3_cute_re"
import { accentColor } from "@/src/theme/colors"

import { Trending } from "../discover/Trending"
import { OnboardingSectionScreenContainer } from "./shared"

const EASE = Easing.bezier(0.25, 1, 0.5, 1)
const enter = (delay: number) => FadeInDown.delay(delay).duration(360).easing(EASE)

export const StepInterests = () => {
  const { t } = useTranslation()
  return (
    <OnboardingSectionScreenContainer>
      <View className="flex items-center gap-4">
        <Animated.View entering={enter(60)}>
          <Search3CuteReIcon height={80} width={80} color={accentColor} />
        </Animated.View>
        <Animated.Text entering={enter(140)} className="mt-2 text-2xl font-bold text-text">
          {t("onboarding.interests_title")}
        </Animated.Text>
        <Animated.Text entering={enter(220)} className="mb-8 px-6 text-center text-lg text-label">
          {t("onboarding.interests_description")}
        </Animated.Text>
      </View>

      <Animated.View entering={enter(300)} className="w-full">
        <Trending className="mb-4 w-full" />
      </Animated.View>
    </OnboardingSectionScreenContainer>
  )
}
