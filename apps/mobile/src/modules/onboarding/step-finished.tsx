import { useTranslation } from "react-i18next"
import { View } from "react-native"
import Animated, { Easing, FadeInDown, ZoomIn } from "react-native-reanimated"

import { Logo } from "@/src/components/ui/logo"

const EASE = Easing.bezier(0.25, 1, 0.5, 1)
const enter = (delay: number) => FadeInDown.delay(delay).duration(360).easing(EASE)

export const StepFinished = () => {
  const { t } = useTranslation()
  return (
    <View className="flex-1 items-center justify-center">
      <Animated.View entering={ZoomIn.delay(60).duration(420).easing(EASE)}>
        <Logo width={80} height={80} />
      </Animated.View>
      <Animated.Text entering={enter(180)} className="my-4 text-3xl font-bold text-text">
        {t("onboarding.finished_title")}
      </Animated.Text>
      <Animated.Text entering={enter(260)} className="mb-8 px-6 text-center text-lg text-label">
        {t("onboarding.finished_description")}
      </Animated.Text>
    </View>
  )
}
