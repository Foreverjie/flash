/* eslint-disable unicorn/no-process-exit */
/**
 * Manual feed sync script.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/sync-feeds.ts
 *   cd apps/api && npx tsx src/scripts/sync-feeds.ts --concurrency 10
 *   cd apps/api && npx tsx src/scripts/sync-feeds.ts --stale 30   # only feeds not fetched in last 30 min
 */
import "dotenv/config"

import { syncAllFeeds } from "../lib/feed-sync.js"

function parseArgs(): { concurrency: number; staleMinutes: number } {
  const args = process.argv.slice(2)
  let concurrency = 5
  let staleMinutes = 0

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--concurrency" || args[i] === "-c") && args[i + 1]) {
      concurrency = Number(args[i + 1]) || 5
      i++
    }
    if ((args[i] === "--stale" || args[i] === "-s") && args[i + 1]) {
      staleMinutes = Number(args[i + 1]) || 0
      i++
    }
  }

  return { concurrency, staleMinutes }
}

async function main() {
  const { concurrency, staleMinutes } = parseArgs()

  console.info(`\n🔄 Starting feed sync...`)
  console.info(`   Concurrency: ${concurrency}`)
  console.info(`   Stale threshold: ${staleMinutes > 0 ? `${staleMinutes} min` : "all feeds"}\n`)

  const summary = await syncAllFeeds({ concurrency, staleMinutes })

  console.info(`\n📊 Sync summary:`)
  console.info(`   Total feeds:  ${summary.totalFeeds}`)
  console.info(`   Succeeded:    ${summary.successCount}`)
  console.info(`   Failed:       ${summary.errorCount}`)
  console.info(`   New posts:    ${summary.newPostsTotal}`)
  console.info(`   Duration:     ${(summary.durationMs / 1000).toFixed(1)}s`)

  if (summary.errorCount > 0) {
    console.info(`\n❌ Failed feeds:`)
    for (const r of summary.results.filter((r) => !r.success)) {
      console.info(`   • ${r.feedTitle || r.url}: ${r.error}`)
    }
  }

  console.info()
  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
