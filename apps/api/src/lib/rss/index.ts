/**
 * RSS Manager
 * Central manager for RSS feed fetching with adapter selection
 * Inspired by Folo project's adapter pattern
 */
import { logger } from "../../utils/logger.js"
import type { BaseAdapter } from "./base-adapter.js"
import { DefaultAdapter } from "./default-adapter.js"
import { GitHubAdapter } from "./github-adapter.js"
import type { AdapterConfig, FetchResult, ParsedFeed } from "./types.js"

/**
 * RSS Manager - handles adapter registration and feed fetching
 */
export class RSSManager {
  private readonly adapters: BaseAdapter[] = []
  private readonly defaultAdapter: BaseAdapter

  constructor(config: AdapterConfig = {}) {
    // Initialize default adapter
    this.defaultAdapter = new DefaultAdapter(config)

    // Register built-in adapters (order matters - first match wins)
    this.registerAdapter(new GitHubAdapter(config))

    logger.info(`[RSSManager] Initialized with ${this.adapters.length} custom adapters`)
  }

  /**
   * Register a custom adapter
   * Adapters are checked in registration order
   */
  registerAdapter(adapter: BaseAdapter): void {
    this.adapters.push(adapter)
    logger.debug(`[RSSManager] Registered adapter: ${adapter.constructor.name}`)
  }

  /**
   * Find the appropriate adapter for a URL
   */
  private findAdapter(url: string): BaseAdapter {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(url)) {
        logger.debug(`[RSSManager] Using ${adapter.constructor.name} for ${url}`)
        return adapter
      }
    }

    logger.debug(`[RSSManager] Using DefaultAdapter for ${url}`)
    return this.defaultAdapter
  }

  /**
   * Fetch and parse a feed URL
   */
  async fetch(url: string): Promise<FetchResult<ParsedFeed>> {
    const adapter = this.findAdapter(url)
    return adapter.fetch(url)
  }

  /**
   * Fetch multiple feeds in parallel
   */
  async fetchMany(
    urls: string[],
    options: { concurrency?: number } = {},
  ): Promise<Map<string, FetchResult<ParsedFeed>>> {
    const { concurrency = 5 } = options
    const results = new Map<string, FetchResult<ParsedFeed>>()

    // Process in batches for controlled concurrency
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map(async (url) => {
          const result = await this.fetch(url)
          return { url, result }
        }),
      )

      for (const { url, result } of batchResults) {
        results.set(url, result)
      }
    }

    return results
  }

  /**
   * Validate a feed URL without fetching all content
   */
  async validate(url: string): Promise<{ valid: boolean; title?: string; error?: string }> {
    try {
      const result = await this.fetch(url)

      if (result.success && result.data) {
        return {
          valid: true,
          title: result.data.title || undefined,
        }
      }

      return {
        valid: false,
        error: result.error || "Failed to parse feed",
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Discover feed URL from a website URL
   */
  async discover(websiteUrl: string): Promise<string[]> {
    const feeds: string[] = []

    try {
      // Common feed paths to check
      const commonPaths = [
        "/feed",
        "/feed.xml",
        "/rss",
        "/rss.xml",
        "/atom.xml",
        "/feed/atom",
        "/blog/feed",
        "/posts.rss",
      ]

      const baseUrl = new URL(websiteUrl)
      const urlsToCheck = commonPaths.map((path) => `${baseUrl.origin}${path}`)

      // Check each URL
      const results = await Promise.allSettled(
        urlsToCheck.map(async (url) => {
          const validation = await this.validate(url)
          return { url, valid: validation.valid }
        }),
      )

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.valid) {
          feeds.push(result.value.url)
        }
      }

      logger.info(`[RSSManager] Discovered ${feeds.length} feeds for ${websiteUrl}`)
    } catch (error) {
      logger.error(`[RSSManager] Feed discovery failed for ${websiteUrl}`, error)
    }

    return feeds
  }
}

// Export singleton instance with default config
export const rssManager = new RSSManager()

// Re-export types and classes for custom adapters
export { BaseAdapter } from "./base-adapter.js"
export { DefaultAdapter } from "./default-adapter.js"
export { GitHubAdapter } from "./github-adapter.js"
export * from "./types.js"
