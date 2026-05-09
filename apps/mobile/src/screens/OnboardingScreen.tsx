import { isNewUserQueryKey, isOnboardingFinishedStorageKey } from "@follow/store/user/constants"
import { tracker } from "@follow/tracker"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, TouchableOpacity, View } from "react-native"
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Text } from "@/src/components/ui/typography/Text"

import { kv } from "../lib/kv"
import { useNavigation } from "../lib/navigation/hooks"
import type { NavigationControllerView } from "../lib/navigation/types"
import { queryClient } from "../lib/query-client"
import { StepFinished } from "../modules/onboarding/step-finished"
import { StepInterests } from "../modules/onboarding/step-interests"
import { StepPreferences } from "../modules/onboarding/step-preferences"
import { StepWelcome } from "../modules/onboarding/step-welcome"

const TRANSITION_DURATION = 280
const EXIT_DURATION = 180
const EASE = Easing.bezier(0.25, 1, 0.5, 1)

export const OnboardingScreen: NavigationControllerView = () => {
  const { t } = useTranslation("common")
  const insets = useSafeAreaInsets()
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4
  const navigation = useNavigation()
  const directionRef = useRef<1 | -1>(1)
  const reduceMotion = useReducedMotion()
  const [finishing, setFinishing] = useState(false)

  const goToStep = useCallback((next: number) => {
    setCurrentStep((prev) => {
      directionRef.current = next >= prev ? 1 : -1
      return next
    })
  }, [])

  const handleNext = useCallback(() => {
    if (finishing) return

    if (currentStep < totalSteps) {
      tracker.onBoarding({ step: currentStep, done: false })
      goToStep(currentStep + 1)
    } else {
      tracker.onBoarding({ step: currentStep, done: true })
      const complete = () => {
        kv.set(isOnboardingFinishedStorageKey, "true")
        queryClient.invalidateQueries({ queryKey: isNewUserQueryKey }).then(() => {
          navigation.back()
        })
      }
      if (reduceMotion) {
        complete()
      } else {
        setFinishing(true)
        setTimeout(complete, 620)
      }
    }
  }, [currentStep, finishing, navigation, reduceMotion, goToStep])

  useEffect(() => {
    tracker.onBoarding({ step: 0, done: false })
  }, [])

  const direction = directionRef.current
  const enterAnim = reduceMotion
    ? FadeIn.duration(120)
    : (direction === 1 ? FadeInRight : FadeInLeft).duration(TRANSITION_DURATION).easing(EASE)
  const exitAnim = reduceMotion
    ? FadeOut.duration(80)
    : (direction === 1 ? FadeOutLeft : FadeOutRight).duration(EXIT_DURATION).easing(EASE)

  return (
    <View
      className="flex-1 bg-system-grouped-background px-6"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} onSelect={goToStep} />

      <Animated.View
        className="flex-1"
        key={`step-${currentStep}`}
        exiting={exitAnim}
        entering={enterAnim}
      >
        {currentStep === 1 && <StepWelcome />}
        {currentStep === 2 && <StepPreferences />}
        {currentStep === 3 && <StepInterests />}
        {currentStep === 4 && <StepFinished />}
      </Animated.View>

      <View className="mb-6 px-6">
        <TouchableOpacity
          onPress={handleNext}
          className="w-full items-center rounded-xl bg-accent py-4"
          activeOpacity={0.85}
          disabled={finishing}
        >
          <Text className="text-lg font-bold text-white">
            {currentStep < totalSteps - 1
              ? t("words.next")
              : currentStep === totalSteps - 1
                ? t("words.finishSetup")
                : t("words.letsGo")}
          </Text>
        </TouchableOpacity>
      </View>

      {finishing && <FinishBurst />}
    </View>
  )
}

function ProgressIndicator({
  currentStep,
  totalSteps,
  onSelect,
}: {
  currentStep: number
  totalSteps: number
  onSelect: (step: number) => void
}) {
  return (
    <View className="mb-6 mt-4 flex flex-row justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, index) => index + 1).map((step) => (
        <ProgressDot
          key={`step-${step}-indicator`}
          isActive={currentStep >= step}
          isCurrent={currentStep === step}
          onPress={() => onSelect(step)}
        />
      ))}
    </View>
  )
}

function ProgressDot({
  isActive,
  isCurrent,
  onPress,
}: {
  isActive: boolean
  isCurrent: boolean
  onPress: () => void
}) {
  const width = useSharedValue(isCurrent ? 48 : 32)
  const scale = useSharedValue(1)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    width.value = withTiming(isCurrent ? 48 : 32, {
      duration: reduceMotion ? 0 : 320,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  }, [isCurrent, reduceMotion, width])

  const animatedStyle = useAnimatedStyle(() => ({
    width: width.value,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPressIn={() => {
        if (!reduceMotion) scale.value = withTiming(0.9, { duration: 100 })
      }}
      onPressOut={() => {
        if (!reduceMotion) scale.value = withTiming(1, { duration: 160 })
      }}
      onPress={onPress}
    >
      <Animated.View
        className={`mx-1 h-2 rounded-full ${isActive ? "bg-accent" : "bg-gray-300"}`}
        style={animatedStyle}
      />
    </Pressable>
  )
}

/**
 * Brand-yellow ripple burst on finish — one-shot delight before navigating away.
 */
function FinishBurst() {
  const ringScale = useSharedValue(0)
  const ringOpacity = useSharedValue(0.55)

  useEffect(() => {
    ringScale.value = withTiming(14, { duration: 700, easing: Easing.bezier(0.16, 1, 0.3, 1) })
    ringOpacity.value = withTiming(0, { duration: 700, easing: Easing.bezier(0.16, 1, 0.3, 1) })
  }, [ringScale, ringOpacity])

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }))

  return (
    <View pointerEvents="none" className="absolute inset-0 z-50 items-center justify-center">
      <Animated.View className="size-32 rounded-full bg-accent" style={ringStyle} />
    </View>
  )
}
