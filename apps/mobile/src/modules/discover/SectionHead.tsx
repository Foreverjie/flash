import { View } from "react-native"

import { Text } from "@/src/components/ui/typography/Text"

/**
 * Discover section heading — compact bold title with an optional trailing
 * control, matching the mobile Discover design.
 */
export const SectionHead = ({
  title,
  className,
  action,
}: {
  title: string
  className?: string
  action?: React.ReactNode
}) => {
  return (
    <View className={className}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[19px] font-bold tracking-tight text-label">{title}</Text>
        {action}
      </View>
    </View>
  )
}
