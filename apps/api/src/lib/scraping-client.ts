export interface ScrapeParams {
  feedId: string
  handle: string
}

export interface ScrapeResult {
  inserted: number
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
        body: JSON.stringify({ feed_id: params.feedId, handle: params.handle }),
        signal: controller.signal,
      })

      if (!resp.ok) {
        const body = await resp.text().catch(() => "")
        throw new Error(`Scraping service error: ${resp.status}${body ? ` — ${body}` : ""}`)
      }

      return (await resp.json()) as ScrapeResult
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(`Scraping service timed out after ${this.timeoutMs}ms`)
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
