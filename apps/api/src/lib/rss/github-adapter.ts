/**
 * GitHub RSS Adapter
 * Specialized adapter for GitHub feeds (releases, commits, activity)
 */
import type Parser from "rss-parser"

import { BaseAdapter } from "./base-adapter.js"
import type { AdapterConfig, FormattedContent, ParsedItem } from "./types.js"

export class GitHubAdapter extends BaseAdapter {
  constructor(config: AdapterConfig = {}) {
    super("GitHubAdapter", {
      userAgent: "FollowBot/1.0 (+https://follow.app; GitHub Feed Reader)",
      ...config,
    })
  }

  /**
   * Check if URL is a GitHub feed
   */
  canHandle(url: string): boolean {
    return (
      url.includes("github.com") &&
      (url.includes("/releases") || url.includes("/commits") || url.includes(".atom"))
    )
  }

  /**
   * Parse GitHub-specific feed items
   */
  protected override async parseItem(
    item: Parser.Item & Record<string, any>,
    feedUrl: string,
  ): Promise<ParsedItem> {
    const baseItem = await super.parseItem(item, feedUrl)

    // Extract GitHub-specific metadata
    const githubData = this.extractGitHubData(item, feedUrl)

    return {
      ...baseItem,
      authorUrl: githubData.authorUrl,
      authorAvatar: githubData.authorAvatar,
      formattedContent: await this.formatGitHubContent(baseItem.content || "", item, githubData),
      extra: {
        ...baseItem.extra,
        ...githubData.extra,
      },
    }
  }

  /**
   * Extract GitHub-specific data from feed item
   */
  private extractGitHubData(
    item: Parser.Item & Record<string, any>,
    feedUrl: string,
  ): {
    authorUrl: string | null
    authorAvatar: string | null
    extra: Record<string, unknown>
  } {
    const extra: Record<string, unknown> = {}

    // Determine feed type
    if (feedUrl.includes("/releases")) {
      extra.type = "release"
    } else if (feedUrl.includes("/commits")) {
      extra.type = "commit"
    } else if (feedUrl.includes("/tags")) {
      extra.type = "tag"
    } else {
      extra.type = "activity"
    }

    // Extract author info from item or URL
    let authorUrl: string | null = null
    let authorAvatar: string | null = null

    // Try to extract from link
    if (item.link) {
      const match = item.link.match(/github\.com\/([^/]+)/)
      if (match) {
        const username = match[1]
        authorUrl = `https://github.com/${username}`
        authorAvatar = `https://github.com/${username}.png`
      }
    }

    // Extract from author field
    if (item.author && typeof item.author === "object" && item.author.uri) {
      authorUrl = item.author.uri
      const username = item.author.uri.split("/").pop()
      if (username) {
        authorAvatar = `https://github.com/${username}.png`
      }
    }

    // Extract version from release title
    if (extra.type === "release" && item.title) {
      const versionMatch = item.title.match(/v?(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)/i)
      if (versionMatch) {
        extra.version = versionMatch[1]
      }
    }

    // Extract commit SHA
    if (extra.type === "commit" && item.id) {
      const shaMatch = item.id.match(/Commit\/([a-f0-9]+)/i)
      if (shaMatch) {
        extra.sha = shaMatch[1]
        extra.shortSha = shaMatch[1].slice(0, 7)
      }
    }

    return { authorUrl, authorAvatar, extra }
  }

  /**
   * Format GitHub-specific content
   */
  private async formatGitHubContent(
    content: string,
    item: Parser.Item & Record<string, any>,
    githubData: { extra: Record<string, unknown> },
  ): Promise<FormattedContent> {
    const baseFormat = await this.formatContent(content, item)

    // Add GitHub-specific metadata
    const metadata: Record<string, unknown> = {
      type: githubData.extra.type,
    }

    if (githubData.extra.version) {
      metadata.version = githubData.extra.version
    }

    if (githubData.extra.sha) {
      metadata.commitSha = githubData.extra.sha
      metadata.shortSha = githubData.extra.shortSha
    }

    // Parse changelog from release content
    if (githubData.extra.type === "release" && content) {
      const changelog = this.parseChangelog(content)
      if (changelog.length > 0) {
        metadata.changelog = changelog
      }
    }

    return {
      ...baseFormat,
      metadata: {
        ...baseFormat.metadata,
        ...metadata,
      },
    }
  }

  /**
   * Parse changelog items from release content
   */
  private parseChangelog(content: string): Array<{ type: string; text: string }> {
    const changelog: Array<{ type: string; text: string }> = []
    const text = this.stripHtml(content)

    // Match bullet points
    const bulletRegex = /^[-*]\s+(\S.*)$/gm
    let match

    while ((match = bulletRegex.exec(text)) !== null) {
      const line = match[1].trim()

      // Categorize the change
      let type = "other"
      const lowerLine = line.toLowerCase()

      if (lowerLine.startsWith("feat") || lowerLine.includes("add") || lowerLine.includes("new")) {
        type = "feature"
      } else if (lowerLine.startsWith("fix") || lowerLine.includes("bug")) {
        type = "fix"
      } else if (lowerLine.startsWith("docs") || lowerLine.includes("document")) {
        type = "docs"
      } else if (lowerLine.startsWith("breaking") || lowerLine.includes("breaking")) {
        type = "breaking"
      } else if (lowerLine.startsWith("perf") || lowerLine.includes("performance")) {
        type = "performance"
      } else if (lowerLine.startsWith("refactor")) {
        type = "refactor"
      }

      changelog.push({ type, text: line })
    }

    return changelog
  }
}
