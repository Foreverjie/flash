import { useViewWithSubscription } from "@follow/store/subscription/hooks"
import { useUnreadByView } from "@follow/store/unread/hooks"
import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ScrollView, useWindowDimensions, View } from "react-native"
import Animated, { interpolate, interpolateColor, useAnimatedStyle } from "react-native-reanimated"

import { ReAnimatedPressable } from "@/src/components/common/AnimatedComponents"
import { TIMELINE_VIEW_SELECTOR_HEIGHT } from "@/src/constants/ui"
import type { ViewDefinition } from "@/src/constants/views"
import { views } from "@/src/constants/views"
import {
  selectTimeline,
  useSelectedFeed,
  useTimelineSelectorDragProgress,
} from "@/src/modules/screen/atoms"
import { accentColor, useColor } from "@/src/theme/colors"

import { TimelineViewSelectorContextMenu } from "./TimelineViewSelectorContextMenu"

// Brand accent foreground (`--fo-accent-fg` on desktop): dark ink that stays
// readable on the yellow accent in both light and dark themes.
const ACCENT_FG = "#1a1207"

// Pill-track geometry (mirrors the design system's mobile tab bar).
const TRACK_MARGIN = 14
const TRACK_PADDING = 3
const TAB_HEIGHT = 32
const TAB_GAP = 4
// Icon-only resting width for tabs that aren't selected.
const COLLAPSED_WIDTH = 44
// Floor for the expanded tab; below this the label crowds the icon, so the
// track starts scrolling instead of squeezing further.
const MIN_EXPANDED_WIDTH = 116
const ICON_SIZE = 15
const ICON_LABEL_GAP = 6
const LABEL_PADDING = 12

// Short one-word labels so every tab fits without truncating.
const shortViewLabelKey = (name: string) =>
  name.replace("feed_view_type.", "feed_view_type_short.") as "feed_view_type_short.all"

/**
 * Category bar over the timeline: a scrollable pill track holding one tab per
 * view (Articles / Social / Pictures / Videos …). The selected tab expands to
 * reveal its label on the brand accent; the others rest as icon-only pills.
 * The pager's drag progress drives both the width and the color crossfade so
 * swipes stay continuous.
 */
export function TimelineViewSelector() {
  const activeViews = useViewWithSubscription()
  const selectedFeed = useSelectedFeed()
  const trackBg = useColor("gray5")
  const { width: windowWidth } = useWindowDimensions()
  const scrollRef = useRef<ScrollView>(null)

  const tabs = useMemo(
    () =>
      activeViews
        .map((v) => views.find((view) => view.view === v))
        .filter((view): view is ViewDefinition => !!view),
    [activeViews],
  )

  // Expanded width is whatever is left once every other tab sits collapsed, so
  // the track fills the row exactly when it fits and overflows into a scroll
  // when it doesn't.
  const innerWidth = windowWidth - TRACK_MARGIN * 2 - TRACK_PADDING * 2
  const expandedWidth = Math.max(
    MIN_EXPANDED_WIDTH,
    innerWidth - (tabs.length - 1) * (COLLAPSED_WIDTH + TAB_GAP),
  )

  const selectedIndex =
    selectedFeed?.type === "view" ? tabs.findIndex((view) => view.view === selectedFeed.viewId) : -1

  // Keep the expanded tab in frame when the selection moves off-screen.
  useEffect(() => {
    if (selectedIndex < 0) return
    const offset = selectedIndex * (COLLAPSED_WIDTH + TAB_GAP)
    scrollRef.current?.scrollTo({
      x: Math.max(0, offset - COLLAPSED_WIDTH),
      animated: true,
    })
  }, [selectedIndex])

  return (
    <View
      className="justify-center"
      style={{ height: TIMELINE_VIEW_SELECTOR_HEIGHT, paddingTop: 8, paddingBottom: 10 }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{
          marginHorizontal: TRACK_MARGIN,
          borderRadius: 999,
          backgroundColor: trackBg,
          flexGrow: 0,
        }}
        contentContainerStyle={{
          padding: TRACK_PADDING,
          gap: TAB_GAP,
          minWidth: innerWidth + TRACK_PADDING * 2,
        }}
      >
        {tabs.map((view, index) => (
          <ViewTab
            key={view.name}
            index={index}
            view={view}
            expandedWidth={expandedWidth}
            isActive={selectedFeed?.type === "view" && selectedFeed.viewId === view.view}
          />
        ))}
      </ScrollView>
    </View>
  )
}

function ViewTab({
  view,
  index,
  expandedWidth,
  isActive,
}: {
  view: ViewDefinition
  // The notification or audio view will be hidden in some cases, so we need to pass the index
  index: number
  expandedWidth: number
  isActive: boolean
}) {
  const { t } = useTranslation("common")
  const label = t(shortViewLabelKey(view.name))
  const unreadCount = useUnreadByView(view.view)
  const dragProgress = useTimelineSelectorDragProgress()
  const inactiveFg = useColor("secondaryLabel")
  // Resting tabs read as "transparent" against the track; interpolating to the
  // track's own color avoids blending through black the way alpha-0 would.
  const trackBg = useColor("gray5")

  // Measured off-screen so the label can animate from 0 to its natural width.
  const [labelWidth, setLabelWidth] = useState(0)

  const range = [index - 1, index, index + 1]
  // Clamp the expanded width to what the label actually needs when the track
  // is scrolling — no point reserving filler space the row can't spare.
  const targetWidth = Math.max(
    expandedWidth,
    ICON_SIZE + ICON_LABEL_GAP + labelWidth + LABEL_PADDING * 2,
  )

  const containerStyle = useAnimatedStyle(() => ({
    width: interpolate(dragProgress.get(), range, [COLLAPSED_WIDTH, targetWidth, COLLAPSED_WIDTH], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    backgroundColor: interpolateColor(dragProgress.get(), range, [trackBg, accentColor, trackBg]),
    // Design lifts the selected pill off the track with `0 1px 4px rgba(0,0,0,.18)`.
    shadowOpacity: interpolate(dragProgress.get(), range, [0, 0.18, 0], "clamp"),
    elevation: interpolate(dragProgress.get(), range, [0, 2, 0], "clamp"),
  }))
  const labelStyle = useAnimatedStyle(() => ({
    width: interpolate(dragProgress.get(), range, [0, labelWidth, 0], "clamp"),
    marginLeft: interpolate(dragProgress.get(), range, [0, ICON_LABEL_GAP, 0], "clamp"),
    opacity: interpolate(dragProgress.get(), range, [0, 1, 0], "clamp"),
  }))
  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragProgress.get(), range, [0, 1, 0]),
  }))
  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragProgress.get(), range, [1, 0, 1]),
  }))
  // The unread dot only reads on the resting (inactive) fill.
  const unreadDotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragProgress.get(), range, [1, 0, 1], "clamp"),
  }))

  return (
    <TimelineViewSelectorContextMenu type="view" viewId={view.view}>
      <ReAnimatedPressable
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isActive }}
        // No `overflow-hidden` here: it would clip the pill's own shadow. The
        // label wrapper clips itself, and the icon always fits the collapsed
        // width, so nothing else needs bounding.
        className="flex-row items-center justify-center rounded-full"
        onPress={() =>
          selectTimeline({
            type: "view",
            viewId: view.view,
          })
        }
        style={[
          {
            height: TAB_HEIGHT,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowRadius: 4,
          },
          containerStyle,
        ]}
      >
        <View className="relative shrink-0" style={{ width: ICON_SIZE, height: ICON_SIZE }}>
          <Animated.View className="absolute" style={activeIconStyle}>
            <view.icon color={ACCENT_FG} height={ICON_SIZE} width={ICON_SIZE} />
          </Animated.View>
          <Animated.View className="absolute" style={inactiveIconStyle}>
            <view.icon color={inactiveFg} height={ICON_SIZE} width={ICON_SIZE} />
          </Animated.View>
        </View>

        <Animated.View className="overflow-hidden" style={labelStyle}>
          <Animated.Text
            allowFontScaling={false}
            className="text-xs font-semibold"
            numberOfLines={1}
            style={{ color: ACCENT_FG, width: labelWidth || undefined }}
          >
            {label}
          </Animated.Text>
        </Animated.View>

        {/* Off-screen measurement pass for the label's natural width. */}
        <Animated.Text
          allowFontScaling={false}
          className="absolute text-xs font-semibold opacity-0"
          numberOfLines={1}
          pointerEvents="none"
          onLayout={(e) => setLabelWidth(Math.ceil(e.nativeEvent.layout.width))}
        >
          {label}
        </Animated.Text>

        {unreadCount > 0 && (
          <Animated.View
            className="absolute right-2.5 top-1 size-1.5 rounded-full"
            style={[{ backgroundColor: accentColor }, unreadDotStyle]}
          />
        )}
      </ReAnimatedPressable>
    </TimelineViewSelectorContextMenu>
  )
}
