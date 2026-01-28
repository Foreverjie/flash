/**
 * RSS Adapter Types and Interfaces
 */

/**
 * Parsed RSS item with formatted content
 */
export interface ParsedItem {
  guid: string
  title: string | null
  url: string | null
  description: string | null
  content: string | null
  author: string | null
  authorUrl: string | null
  authorAvatar: string | null
  publishedAt: Date | null
  categories: string[]
  media: MediaItem[]
  attachments: Attachment[]
  formattedContent: FormattedContent
  extra: Record<string, unknown>
}

/**
 * Parsed RSS feed metadata
 */
export interface ParsedFeed {
  title: string | null
  description: string | null
  siteUrl: string | null
  image: string | null
  language: string | null
  lastBuildDate: Date | null
  ttl: number | null
  items: ParsedItem[]
}

/**
 * Media item (image, video, audio)
 */
export interface MediaItem {
  url: string
  type: "image" | "video" | "audio"
  width?: number
  height?: number
  duration?: number
  blurhash?: string
}

/**
 * Attachment (podcast, PDF, etc.)
 */
export interface Attachment {
  url: string
  title?: string
  mimeType?: string
  size?: number
}

/**
 * Formatted content structure for rich display
 */
export interface FormattedContent {
  html?: string
  markdown?: string
  text?: string
  images?: Array<{
    url: string
    alt?: string
    width?: number
    height?: number
  }>
  videos?: Array<{
    url: string
    thumbnail?: string
    duration?: number
  }>
  links?: Array<{
    url: string
    title?: string
    type?: string
  }>
  metadata?: Record<string, unknown>
}

/**
 * Adapter configuration options
 */
export interface AdapterConfig {
  timeout?: number
  userAgent?: string
  headers?: Record<string, string>
  customRules?: CustomRule[]
}

/**
 * Custom parsing rule for specific content
 */
export interface CustomRule {
  selector: string
  attribute?: string
  transform?: (value: string) => string
}

/**
 * Fetch result with potential errors
 */
export interface FetchResult<T> {
  success: boolean
  data?: T
  error?: string
  statusCode?: number
}
