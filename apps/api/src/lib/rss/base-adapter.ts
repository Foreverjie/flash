/**
 * Base RSS Adapter
 * Abstract class that defines the interface for all RSS adapters
 */
import Parser from "rss-parser"

import { logger } from "../../utils/logger.js"
import type {
  AdapterConfig,
  Attachment,
  FetchResult,
  FormattedContent,
  MediaItem,
  ParsedFeed,
  ParsedItem,
} from "./types.js"

export abstract class BaseAdapter {
  protected readonly name: string
  protected readonly config: AdapterConfig
  protected readonly parser: Parser

  constructor(name: string, config: AdapterConfig = {}) {
    this.name = name
    this.config = {
      timeout: 30000,
      userAgent: "FollowBot/1.0 (+https://follow.app)",
      ...config,
    }
    this.parser = new Parser({
      timeout: this.config.timeout,
      headers: {
        "User-Agent": this.config.userAgent!,
        ...this.config.headers,
      },
      customFields: {
        feed: ["image", "language", "ttl"],
        item: [
          ["media:content", "mediaContent"],
          ["media:thumbnail", "mediaThumbnail"],
          ["enclosure", "enclosure"],
          ["content:encoded", "contentEncoded"],
        ],
      },
    })
  }

  /**
   * Check if this adapter can handle the given URL
   */
  abstract canHandle(url: string): boolean

  /**
   * Fetch and parse an RSS feed
   */
  async fetch(url: string): Promise<FetchResult<ParsedFeed>> {
    try {
      logger.info(`[${this.name}] Fetching feed: ${url}`)

      const feed = await this.parser.parseURL(url)
      const parsedFeed = await this.parseFeed(feed, url)

      logger.info(`[${this.name}] Parsed ${parsedFeed.items.length} items from ${url}`)

      return {
        success: true,
        data: parsedFeed,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(`[${this.name}] Failed to fetch feed: ${url}`, error)

      return {
        success: false,
        error: message,
      }
    }
  }

  /**
   * Parse the raw feed into our standard format
   */
  protected async parseFeed(
    feed: Parser.Output<Record<string, any>> & Record<string, any>,
    url: string,
  ): Promise<ParsedFeed> {
    const items = await Promise.all(feed.items.map((item) => this.parseItem(item, url)))

    return {
      title: feed.title || null,
      description: feed.description || null,
      siteUrl: feed.link || this.extractDomain(url),
      image: this.extractFeedImage(feed),
      language: (feed as any).language || null,
      lastBuildDate: (feed as any).lastBuildDate ? new Date((feed as any).lastBuildDate) : null,
      ttl: (feed as any).ttl ? Number.parseInt((feed as any).ttl, 10) : null,
      items,
    }
  }

  /**
   * Parse a single feed item
   */
  protected async parseItem(
    item: Parser.Item & Record<string, any>,
    feedUrl: string,
  ): Promise<ParsedItem> {
    const content =
      item.contentEncoded || item["content:encoded"] || item.content || item.description || ""
    const media = this.extractMedia(item)
    const attachments = this.extractAttachments(item)
    const formattedContent = await this.formatContent(content, item)

    return {
      guid: item.guid || item.id || item.link || `${feedUrl}-${Date.now()}`,
      title: item.title || null,
      url: item.link || null,
      description: this.sanitizeText(item.description || item.summary || null),
      content: content || null,
      author: item.creator || item.author || null,
      authorUrl: null,
      authorAvatar: null,
      publishedAt: item.pubDate || item.isoDate ? new Date(item.pubDate || item.isoDate!) : null,
      categories: item.categories || [],
      media,
      attachments,
      formattedContent,
      extra: this.extractExtra(item),
    }
  }

  /**
   * Format content for rich display
   * Can be overridden by specific adapters
   */
  protected async formatContent(
    content: string,
    _item: Parser.Item & Record<string, any>,
  ): Promise<FormattedContent> {
    const images = this.extractImagesFromHtml(content)
    const links = this.extractLinksFromHtml(content)

    return {
      html: content,
      text: this.stripHtml(content),
      images,
      links,
    }
  }

  /**
   * Extract media items (images, videos) from feed item
   */
  protected extractMedia(item: Parser.Item & Record<string, any>): MediaItem[] {
    const media: MediaItem[] = []

    // Handle media:content
    if (item.mediaContent) {
      const mediaItems = Array.isArray(item.mediaContent) ? item.mediaContent : [item.mediaContent]
      for (const m of mediaItems) {
        if (m.$ && m.$.url) {
          media.push({
            url: m.$.url,
            type: this.getMediaType(m.$.type || m.$.medium),
            width: m.$.width ? Number.parseInt(m.$.width, 10) : undefined,
            height: m.$.height ? Number.parseInt(m.$.height, 10) : undefined,
          })
        }
      }
    }

    // Handle media:thumbnail
    if (item.mediaThumbnail) {
      const thumbnails = Array.isArray(item.mediaThumbnail)
        ? item.mediaThumbnail
        : [item.mediaThumbnail]
      for (const t of thumbnails) {
        if (t.$ && t.$.url) {
          media.push({
            url: t.$.url,
            type: "image",
            width: t.$.width ? Number.parseInt(t.$.width, 10) : undefined,
            height: t.$.height ? Number.parseInt(t.$.height, 10) : undefined,
          })
        }
      }
    }

    return media
  }

  /**
   * Extract attachments (enclosures) from feed item
   */
  protected extractAttachments(item: Parser.Item & Record<string, any>): Attachment[] {
    const attachments: Attachment[] = []

    if (item.enclosure) {
      const enclosures = Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure]
      for (const e of enclosures) {
        const enc = e.$ || e
        if (enc.url) {
          attachments.push({
            url: enc.url,
            mimeType: enc.type,
            size: enc.length > 0 ? Number.parseInt(enc.length, 10) : undefined,
          })
        }
      }
    }

    return attachments
  }

  /**
   * Extract additional metadata from feed item
   */
  protected extractExtra(item: Parser.Item & Record<string, any>): Record<string, unknown> {
    const extra: Record<string, unknown> = {}

    // Add any custom fields that weren't handled
    const standardFields = new Set([
      "title",
      "link",
      "description",
      "content",
      "contentEncoded",
      "pubDate",
      "isoDate",
      "guid",
      "id",
      "creator",
      "author",
      "categories",
      "mediaContent",
      "mediaThumbnail",
      "enclosure",
    ])

    for (const [key, value] of Object.entries(item)) {
      if (!standardFields.has(key) && value !== undefined && value !== null) {
        extra[key] = value
      }
    }

    return extra
  }

  /**
   * Extract feed image from various sources
   */
  protected extractFeedImage(feed: Parser.Output<Record<string, any>>): string | null {
    if (feed.image?.url) return feed.image.url
    if (typeof feed.image === "string") return feed.image
    if (feed.itunes?.image) return feed.itunes.image
    return null
  }

  /**
   * Extract domain from URL
   */
  protected extractDomain(url: string): string {
    try {
      const parsed = new URL(url)
      return `${parsed.protocol}//${parsed.host}`
    } catch {
      return url
    }
  }

  /**
   * Determine media type from MIME type or medium attribute
   */
  protected getMediaType(type?: string): MediaItem["type"] {
    if (!type) return "image"
    const t = type.toLowerCase()
    if (t.includes("video")) return "video"
    if (t.includes("audio")) return "audio"
    return "image"
  }

  /**
   * Strip HTML tags from string
   */
  protected stripHtml(html: string | null): string {
    if (!html) return ""
    return html
      .replaceAll(/<[^>]*>/g, "")
      .replaceAll("&nbsp;", " ")
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll(/\s+/g, " ")
      .trim()
  }

  /**
   * Sanitize text content
   */
  protected sanitizeText(text: string | null): string | null {
    if (!text) return null
    return this.stripHtml(text).slice(0, 500)
  }

  /**
   * Extract images from HTML content
   */
  protected extractImagesFromHtml(html: string): FormattedContent["images"] {
    const images: FormattedContent["images"] = []
    const imgRegex = /<img\s[^>]*?src=["']([^"']+)["'][^>]*>/gi
    let match

    while ((match = imgRegex.exec(html)) !== null) {
      images.push({
        url: match[1],
        alt: match[2] || undefined,
      })
    }

    return images
  }

  /**
   * Extract links from HTML content
   */
  protected extractLinksFromHtml(html: string): FormattedContent["links"] {
    const links: FormattedContent["links"] = []
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
    let match

    while ((match = linkRegex.exec(html)) !== null) {
      links.push({
        url: match[1],
        title: match[2] || undefined,
      })
    }

    return links
  }
}
