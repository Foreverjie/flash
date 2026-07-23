import type {
  collectionsTable,
  entriesTable,
  feedsTable,
  imagesTable,
  inboxesTable,
  listsTable,
  subscriptionsTable,
  summariesTable,
  translationsTable,
  unreadTable,
  usersTable,
} from "."

export type SubscriptionSchema = typeof subscriptionsTable.$inferInsert

export type FeedSchema = typeof feedsTable.$inferInsert

export type InboxSchema = typeof inboxesTable.$inferInsert

export type ListSchema = typeof listsTable.$inferInsert

export type UnreadSchema = typeof unreadTable.$inferInsert

export type UserSchema = typeof usersTable.$inferInsert

export type EntrySchema = typeof entriesTable.$inferInsert

export type CollectionSchema = typeof collectionsTable.$inferInsert

export type SummarySchema = typeof summariesTable.$inferInsert

export type TranslationSchema = typeof translationsTable.$inferInsert

export type ImageSchema = typeof imagesTable.$inferInsert

export type MediaModel = {
  url: string
  type: "photo" | "video"
  preview_image_url?: string
  width?: number
  height?: number
  blurhash?: string
}

export type AttachmentsModel = {
  url: string
  duration_in_seconds?: number | string
  mime_type?: string
  size_in_bytes?: number
  title?: string
}

/** Structured second-hand property listing behind the Property Feed card. */
export type PropertyListing = {
  community: string
  title: string
  city: string
  hood: string
  beds: number
  halls: number
  baths: number
  area: number
  total: string
  total_num: number
  unit: string
  unit_num: number
  floor: string
  orientation: string
  reno: string
  tags: string[]
  badge: "new" | "reduced" | ""
  reduced_by: string
  orig: string
  sold: boolean
  image: string
}

export type ExtraModel = {
  links?: {
    url: string
    type: string
    content_html?: string
  }[]
  title_keyword?: string
  property?: PropertyListing
}

// export { ImageColorsResult } from "react-native-image-colors"

interface AndroidImageColors {
  dominant: string
  average: string
  vibrant: string
  darkVibrant: string
  lightVibrant: string
  darkMuted: string
  lightMuted: string
  muted: string
  platform: "android"
}

interface WebImageColors {
  dominant: string
  vibrant: string
  darkVibrant: string
  lightVibrant: string
  darkMuted: string
  lightMuted: string
  muted: string
  platform: "web"
}

interface IOSImageColors {
  background: string
  primary: string
  secondary: string
  detail: string
  platform: "ios"
}

export type ImageColorsResult = AndroidImageColors | IOSImageColors | WebImageColors
