/** Feed adapter types backed by the Python scraping service. */
export const SCRAPLING_ADAPTER_TYPES = [
  "x_timeline",
  "bilibili_up_video",
  "leyoujia_community",
  "qfang_community",
] as const

export type ScraplingAdapterType = (typeof SCRAPLING_ADAPTER_TYPES)[number]

export function isScraplingAdapterType(value: string | null): value is ScraplingAdapterType {
  return SCRAPLING_ADAPTER_TYPES.includes(value as ScraplingAdapterType)
}

export interface ScrapeParams {
  feedId: string
  adapterType: ScraplingAdapterType
  source: string
}

export interface ScrapeResult {
  inserted: number
}

/**
 * The scraping service could not be reached, timed out, or failed on its own
 * side. This says nothing about the feed, so callers must not record it as a
 * feed error — that would flag a healthy feed as broken for every subscriber
 * whenever the scraper is down or not running locally.
 */
export class ScrapingServiceUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "ScrapingServiceUnavailableError"
  }
}

export class ScrapingClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async scrape(params: ScrapeParams): Promise<ScrapeResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const resp = await fetch(`${this.baseUrl}/scrape`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-key": this.apiKey,
        },
        body: JSON.stringify({
          feed_id: params.feedId,
          adapter_type: params.adapterType,
          source: params.source,
        }),
        signal: controller.signal,
      })

      if (!resp.ok) {
        const body = await resp.text().catch(() => "")
        const detail = `${resp.status}${body ? ` — ${body}` : ""}`
        // 5xx is the scraper failing, not the feed. 4xx means it processed the
        // request and rejected it, which does say something about the feed.
        if (resp.status >= 500) {
          throw new ScrapingServiceUnavailableError(`Scraping service error: ${detail}`)
        }
        throw new Error(`Scraping service error: ${detail}`)
      }

      return (await resp.json()) as ScrapeResult
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ScrapingServiceUnavailableError(
          `Scraping service timed out after ${this.timeoutMs}ms`,
        )
      }
      if (err instanceof ScrapingServiceUnavailableError) throw err
      // A transport failure (service not running, DNS, refused connection)
      // surfaces as a bare TypeError from fetch.
      if (err instanceof TypeError) {
        throw new ScrapingServiceUnavailableError(
          `Cannot reach the scraping service at ${this.baseUrl}`,
          { cause: err },
        )
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
}

// Singleton — configured from env
export const scrapingClient = new ScrapingClient(
  process.env.SCRAPER_SERVICE_URL ?? "http://localhost:8000",
  process.env.INTERNAL_API_KEY ?? "dev-secret",
)
