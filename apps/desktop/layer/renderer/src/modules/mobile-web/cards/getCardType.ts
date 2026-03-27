import { FeedViewType } from "@follow/constants"

export type CardType = "article" | "image" | "video" | "podcast"

export function getCardType(
  viewType: FeedViewType,
  entry?: { media?: Array<{ type: string }> },
): CardType {
  switch (viewType) {
    case FeedViewType.Pictures:
      return "image"
    case FeedViewType.Videos:
      return "video"
    case FeedViewType.Audios:
      return "podcast"
    case FeedViewType.Articles:
    case FeedViewType.SocialMedia:
    case FeedViewType.Notifications:
    default: {
      if (!entry?.media?.length) return "article"
      const hasVideo = entry.media.some((m) => m.type === "video")
      if (hasVideo) return "video"
      const imageCount = entry.media.filter((m) => m.type === "photo").length
      if (imageCount >= 2) return "image"
      return "article"
    }
  }
}
