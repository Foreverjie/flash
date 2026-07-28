export const FeedView = {
  Articles: 0,
  SocialMedia: 1,
  Pictures: 2,
  Videos: 3,
  Audios: 4,
  Notifications: 5,
} as const

export type FeedView = (typeof FeedView)[keyof typeof FeedView]

const adapterViewMap: Readonly<Record<string, FeedView>> = {
  bilibili_up_video: FeedView.Videos,
  x_timeline: FeedView.SocialMedia,
}

export const isFeedView = (value: unknown): value is FeedView =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5

export const resolveFeedView = (adapterType: string | null | undefined): FeedView =>
  adapterType ? (adapterViewMap[adapterType] ?? FeedView.Articles) : FeedView.Articles

export const resolveSubscriptionView = (
  view: unknown,
  adapterType: string | null | undefined,
): FeedView => (isFeedView(view) ? view : resolveFeedView(adapterType))
