import { FeedViewType } from "@follow/constants"

export type CardType = "article" | "image" | "video" | "podcast"

export function getCardType(
  viewType: FeedViewType,
  entry?: { media?: Array<{ type: string }> },
): CardType {
  if (viewType === FeedViewType.Pictures) {
    return "image"
  }
  if (viewType === FeedViewType.Videos) {
    return "video"
  }
  if (viewType === FeedViewType.Audios) {
    return "podcast"
  }

  // Default case for Articles, SocialMedia, Notifications, and others
  if (!entry?.media?.length) return "article"
  const hasVideo = entry.media.some((m) => m.type === "video")
  if (hasVideo) return "video"
  const imageCount = entry.media.filter((m) => m.type === "photo").length
  if (imageCount >= 2) return "image"
  return "article"
}
