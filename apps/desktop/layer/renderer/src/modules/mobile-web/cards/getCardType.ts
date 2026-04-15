import { FeedViewType } from "@follow/constants"

export type CardType = "article" | "image" | "video" | "podcast"

export function getCardType(
  viewType: FeedViewType,
  entry?: {
    media?: Array<{ type: string }>
    attachments?: Array<{ mime_type?: string; duration_in_seconds?: number | string }>
  },
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
  const hasVideo =
    entry?.media?.some((m) => m.type === "video") ||
    entry?.attachments?.some((attachment) => attachment.mime_type?.startsWith("video/")) ||
    false
  if (hasVideo) return "video"
  const imageCount = entry?.media?.filter((m) => m.type === "photo").length ?? 0
  if (imageCount >= 2) return "image"
  return "article"
}
