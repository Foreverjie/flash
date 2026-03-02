/* eslint-disable unicorn/no-process-exit */
/**
 * Manual post scraping script.
 *
 * Runs both the producer (enqueue) and consumer (process) phases locally
 * so you can test the full pipeline without Vercel cron.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/scrape-posts.ts
 *   cd apps/api && npx tsx src/scripts/scrape-posts.ts --batch 10 --concurrency 3
 *   cd apps/api && npx tsx src/scripts/scrape-posts.ts --enqueue-only   # only enqueue, don't process
 *   cd apps/api && npx tsx src/scripts/scrape-posts.ts --process-only   # only process pending
 *   cd apps/api && npx tsx src/scripts/scrape-posts.ts --stats          # show queue stats only
 */
import "dotenv/config"

import { enqueuePostsForScraping, getScrapeStats, processScrapeBatch } from "../lib/scrape-queue.js"

function parseArgs() {
  const args = process.argv.slice(2)
  let batchSize = 5
  let concurrency = 2
  let enqueueLimit = 100
  let enqueueOnly = false
  let processOnly = false
  let statsOnly = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = args[i + 1]

    if ((arg === "--batch" || arg === "-b") && next) {
      batchSize = Number(next) || 5
      i++
    } else if ((arg === "--concurrency" || arg === "-c") && next) {
      concurrency = Number(next) || 2
      i++
    } else if ((arg === "--limit" || arg === "-l") && next) {
      enqueueLimit = Number(next) || 100
      i++
    } else
      switch (arg) {
        case "--enqueue-only": {
          enqueueOnly = true

          break
        }
        case "--process-only": {
          processOnly = true

          break
        }
        case "--stats": {
          statsOnly = true

          break
        }
        // No default
      }
  }

  return { batchSize, concurrency, enqueueLimit, enqueueOnly, processOnly, statsOnly }
}

async function main() {
  const { batchSize, concurrency, enqueueLimit, enqueueOnly, processOnly, statsOnly } = parseArgs()

  // Stats only
  if (statsOnly) {
    const stats = await getScrapeStats()
    console.info("\n📊 Scrape Queue Stats:")
    console.info(`   Pending:    ${stats.pending}`)
    console.info(`   Processing: ${stats.processing}`)
    console.info(`   Scraped:    ${stats.scraped}`)
    console.info(`   Failed:     ${stats.failed}`)
    console.info(`   Unqueued:   ${stats.unqueued}`)
    console.info()
    process.exit(0)
  }

  // Phase 1: Enqueue
  if (!processOnly) {
    console.info(`\n📥 Enqueueing posts for scraping (limit=${enqueueLimit})...`)
    const enqueueResult = await enqueuePostsForScraping(enqueueLimit)
    console.info(
      `   Enqueued: ${enqueueResult.enqueued} (${enqueueResult.alreadyQueued} re-queued)`,
    )
  }

  if (enqueueOnly) {
    const stats = await getScrapeStats()
    console.info(
      `\n📊 Queue: ${stats.pending} pending, ${stats.scraped} scraped, ${stats.failed} failed`,
    )
    console.info()
    process.exit(0)
  }

  // Phase 2: Process
  console.info(`\n🔄 Processing scrape batch (size=${batchSize}, concurrency=${concurrency})...\n`)
  const result = await processScrapeBatch(batchSize, concurrency)

  console.info(`\n📊 Scrape Results:`)
  console.info(`   Processed: ${result.processed}`)
  console.info(`   Succeeded: ${result.succeeded}`)
  console.info(`   Failed:    ${result.failed}`)
  console.info(`   Skipped:   ${result.skipped}`)
  console.info(`   Duration:  ${(result.durationMs / 1000).toFixed(1)}s`)

  if (result.results.length > 0) {
    console.info(`\n   Details:`)
    for (const r of result.results) {
      const icon = r.success ? "✅" : "❌"
      const detail = r.success ? `(${r.attempts} attempt${r.attempts > 1 ? "s" : ""})` : r.error
      console.info(`   ${icon} ${r.title || r.url} — ${detail}`)
    }
  }

  const stats = await getScrapeStats()
  console.info(
    `\n📊 Queue: ${stats.pending} pending, ${stats.processing} processing, ${stats.scraped} scraped, ${stats.failed} failed`,
  )
  console.info()
  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
