import { getStorageNS } from "@follow/utils/ns"

/// Feed
export const FEED_COLLECTION_LIST = "collections"

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
/// Local storage keys
export const QUERY_PERSIST_KEY = getStorageNS("REACT_QUERY_OFFLINE_CACHE")
export const I18N_LOCALE_KEY = getStorageNS("I18N_LOCALE")

/// Route Keys
export const ROUTE_VIEW_ALL = "all"
export const ROUTE_FEED_PENDING = "all"
export const ROUTE_ENTRY_PENDING = "pending"
export const ROUTE_FEED_IN_FOLDER = "folder-"
export const ROUTE_FEED_IN_LIST = "list-"
export const ROUTE_FEED_IN_INBOX = "inbox-"
export const ROUTE_TIMELINE_OF_VIEW = "view-"
