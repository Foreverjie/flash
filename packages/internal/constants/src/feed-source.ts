/**
 * Feed URL schemes served by the Python scraping service rather than RSS.
 * These feeds have no fetchable HTTP URL, so refreshing one means asking the
 * scraper to re-scrape — which any subscriber may do, not just the owner.
 */
export const SCRAPER_FEED_SCHEMES = [
  "x_timeline://",
  "bilibili_up_video://",
  "leyoujia_community://",
  "qfang_community://",
]

export const isScraperBackedFeedUrl = (url?: string | null) =>
  !!url && SCRAPER_FEED_SCHEMES.some((scheme) => url.startsWith(scheme))
