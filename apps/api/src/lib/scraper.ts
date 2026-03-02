/**
 * Content Scraper Engine
 *
 * Fetches the full article content from a URL using @mozilla/readability + linkedom.
 * Sanitizes HTML output by stripping scripts, ads, and tracking elements.
 * Includes retry logic with exponential backoff for transient failures.
 */
import { Readability } from "@mozilla/readability"
import { parseHTML } from "linkedom"

import { logger } from "../utils/logger.js"

export interface ScrapeResult {
  success: boolean
  title?: string
  content?: string // Clean HTML
  textContent?: string // Plain text
  excerpt?: string
  siteName?: string
  byline?: string
  error?: string
  statusCode?: number
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const BLOCKED_STATUS_CODES = new Set([403, 451])
const RATE_LIMITED_STATUS_CODES = new Set([429])

/**
 * Elements and attributes to strip from extracted content
 */
const STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe[src*='ad']",
  "iframe[src*='track']",
  "[class*='ad-']",
  "[class*='advertisement']",
  "[class*='social-share']",
  "[class*='newsletter']",
  "[id*='ad-']",
  "[id*='advertisement']",
  "[data-ad]",
  "[aria-label='advertisement']",
].join(", ")

/**
 * Fetch a URL and extract the main article content.
 */
export async function scrapeArticle(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
      },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    })

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
      }
    }

    const html = await response.text()

    if (!html || html.length < 100) {
      return { success: false, error: "Empty or too-short response body" }
    }

    // Parse HTML using linkedom (server-side DOM)
    const { document } = parseHTML(html)

    // Strip unwanted elements before Readability processing
    for (const el of document.querySelectorAll(STRIP_SELECTORS)) {
      el.remove()
    }

    const reader = new Readability(document as any, {
      charThreshold: 50,
    })

    const article = reader.parse()

    if (!article || !article.content) {
      return { success: false, error: "Readability could not extract article content" }
    }

    // Post-process: sanitize the extracted HTML
    const cleanHtml = sanitizeHtml(article.content)

    return {
      success: true,
      title: article.title || undefined,
      content: cleanHtml,
      textContent: article.textContent?.trim() || undefined,
      excerpt: article.excerpt || undefined,
      siteName: article.siteName || undefined,
      byline: article.byline || undefined,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { success: false, error: "Request timed out (15s)" }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}

/**
 * Sanitize extracted HTML: remove remaining scripts, event handlers, tracking pixels.
 */
function sanitizeHtml(html: string): string {
  return (
    html
      // Remove any remaining script/style blocks
      .replaceAll(/<script[\s\S]*?<\/script>/gi, "")
      .replaceAll(/<style[\s\S]*?<\/style>/gi, "")
      // Remove event handler attributes
      .replaceAll(/\s+on\w+="[^"]*"/gi, "")
      .replaceAll(/\s+on\w+='[^']*'/gi, "")
      // Remove tracking pixel images (1x1)
      .replaceAll(/<img[^>]+(?:width|height)=["']1["'][^>]*>/gi, "")
      // Remove data-* attributes (tracking)
      .replaceAll(/\s+data-[\w-]+="[^"]*"/gi, "")
      .trim()
  )
}

/**
 * Retry wrapper with exponential backoff.
 *
 * @param url - The article URL to scrape
 * @param maxAttempts - Maximum number of attempts (default 3)
 * @returns ScrapeResult from the final attempt
 */
export async function scrapeWithRetry(
  url: string,
  maxAttempts = 3,
): Promise<ScrapeResult & { attempts: number }> {
  let lastResult: ScrapeResult = { success: false, error: "No attempts made" }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await scrapeArticle(url)

    if (lastResult.success) {
      return { ...lastResult, attempts: attempt }
    }

    // Don't retry on permanent failures (403, 451)
    if (lastResult.statusCode && BLOCKED_STATUS_CODES.has(lastResult.statusCode)) {
      logger.warn(`[Scraper] Permanent block (${lastResult.statusCode}) for ${url}, not retrying`)
      return { ...lastResult, attempts: attempt }
    }

    // Backoff before retry (exponential: 2s, 4s, 8s…)
    if (attempt < maxAttempts) {
      const backoffMs = RATE_LIMITED_STATUS_CODES.has(lastResult.statusCode ?? 0)
        ? 5000 * attempt // Longer delay for 429
        : 2000 * 2 ** (attempt - 1)

      logger.info(
        `[Scraper] Attempt ${attempt}/${maxAttempts} failed for ${url}: ${lastResult.error}. Retrying in ${backoffMs}ms`,
      )
      await sleep(backoffMs)
    }
  }

  return { ...lastResult, attempts: maxAttempts }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
