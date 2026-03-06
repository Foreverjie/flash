/* eslint-disable unicorn/no-process-exit */
/**
 * Import feeds from an OPML file into the database.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/import-opml.ts
 */
import "dotenv/config"

import { eq } from "drizzle-orm"

import { db, feeds, posts } from "../db/index.js"
import { rssManager } from "../lib/rss/index.js"
import { generateSnowflakeId } from "../utils/id.js"

const OPML_FEEDS = [
  { title: "simonwillison.net", xmlUrl: "https://simonwillison.net/atom/everything/" },
  { title: "jeffgeerling.com", xmlUrl: "https://www.jeffgeerling.com/blog.xml" },
  { title: "seangoedecke.com", xmlUrl: "https://www.seangoedecke.com/rss.xml" },
  { title: "krebsonsecurity.com", xmlUrl: "https://krebsonsecurity.com/feed/" },
  { title: "daringfireball.net", xmlUrl: "https://daringfireball.net/feeds/main" },
  { title: "ericmigi.com", xmlUrl: "https://ericmigi.com/rss.xml" },
  { title: "antirez.com", xmlUrl: "http://antirez.com/rss" },
  { title: "idiallo.com", xmlUrl: "https://idiallo.com/feed.rss" },
  { title: "maurycyz.com", xmlUrl: "https://maurycyz.com/index.xml" },
  { title: "pluralistic.net", xmlUrl: "https://pluralistic.net/feed/" },
  { title: "shkspr.mobi", xmlUrl: "https://shkspr.mobi/blog/feed/" },
  { title: "lcamtuf.substack.com", xmlUrl: "https://lcamtuf.substack.com/feed" },
  { title: "mitchellh.com", xmlUrl: "https://mitchellh.com/feed.xml" },
  { title: "dynomight.net", xmlUrl: "https://dynomight.net/feed.xml" },
  { title: "utcc.utoronto.ca/~cks", xmlUrl: "https://utcc.utoronto.ca/~cks/space/blog/?atom" },
  { title: "xeiaso.net", xmlUrl: "https://xeiaso.net/blog.rss" },
  {
    title: "devblogs.microsoft.com/oldnewthing",
    xmlUrl: "https://devblogs.microsoft.com/oldnewthing/feed",
  },
  { title: "righto.com", xmlUrl: "https://www.righto.com/feeds/posts/default" },
  { title: "lucumr.pocoo.org", xmlUrl: "https://lucumr.pocoo.org/feed.atom" },
  { title: "skyfall.dev", xmlUrl: "https://skyfall.dev/rss.xml" },
  { title: "garymarcus.substack.com", xmlUrl: "https://garymarcus.substack.com/feed" },
  { title: "rachelbythebay.com", xmlUrl: "https://rachelbythebay.com/w/atom.xml" },
  { title: "overreacted.io", xmlUrl: "https://overreacted.io/rss.xml" },
  { title: "timsh.org", xmlUrl: "https://timsh.org/rss/" },
  { title: "johndcook.com", xmlUrl: "https://www.johndcook.com/blog/feed/" },
  { title: "gilesthomas.com", xmlUrl: "https://gilesthomas.com/feed/rss.xml" },
  { title: "matklad.github.io", xmlUrl: "https://matklad.github.io/feed.xml" },
  { title: "derekthompson.org", xmlUrl: "https://www.theatlantic.com/feed/author/derek-thompson/" },
  { title: "evanhahn.com", xmlUrl: "https://evanhahn.com/feed.xml" },
  { title: "terriblesoftware.org", xmlUrl: "https://terriblesoftware.org/feed/" },
  { title: "rakhim.exotext.com", xmlUrl: "https://rakhim.exotext.com/rss.xml" },
  { title: "joanwestenberg.com", xmlUrl: "https://joanwestenberg.com/rss" },
  { title: "xania.org", xmlUrl: "https://xania.org/feed" },
  { title: "micahflee.com", xmlUrl: "https://micahflee.com/feed/" },
  { title: "nesbitt.io", xmlUrl: "https://nesbitt.io/feed.xml" },
  { title: "construction-physics.com", xmlUrl: "https://www.construction-physics.com/feed" },
  { title: "tedium.co", xmlUrl: "https://feed.tedium.co/" },
  { title: "susam.net", xmlUrl: "https://susam.net/feed.xml" },
  { title: "entropicthoughts.com", xmlUrl: "https://entropicthoughts.com/feed.xml" },
  { title: "buttondown.com/hillelwayne", xmlUrl: "https://buttondown.com/hillelwayne/rss" },
  { title: "dwarkesh.com", xmlUrl: "https://www.dwarkeshpatel.com/feed" },
  { title: "borretti.me", xmlUrl: "https://borretti.me/feed.xml" },
  { title: "wheresyoured.at", xmlUrl: "https://www.wheresyoured.at/rss/" },
  { title: "jayd.ml", xmlUrl: "https://jayd.ml/feed.xml" },
  { title: "minimaxir.com", xmlUrl: "https://minimaxir.com/index.xml" },
  { title: "geohot.github.io", xmlUrl: "https://geohot.github.io/blog/feed.xml" },
  { title: "paulgraham.com", xmlUrl: "http://www.aaronsw.com/2002/feeds/pgessays.rss" },
  { title: "filfre.net", xmlUrl: "https://www.filfre.net/feed/" },
  { title: "blog.jim-nielsen.com", xmlUrl: "https://blog.jim-nielsen.com/feed.xml" },
  { title: "dfarq.homeip.net", xmlUrl: "https://dfarq.homeip.net/feed/" },
  { title: "jyn.dev", xmlUrl: "https://jyn.dev/atom.xml" },
  { title: "geoffreylitt.com", xmlUrl: "https://www.geoffreylitt.com/feed.xml" },
  { title: "downtowndougbrown.com", xmlUrl: "https://www.downtowndougbrown.com/feed/" },
  { title: "brutecat.com", xmlUrl: "https://brutecat.com/rss.xml" },
  { title: "eli.thegreenplace.net", xmlUrl: "https://eli.thegreenplace.net/feeds/all.atom.xml" },
  { title: "abortretry.fail", xmlUrl: "https://www.abortretry.fail/feed" },
  { title: "fabiensanglard.net", xmlUrl: "https://fabiensanglard.net/rss.xml" },
  { title: "oldvcr.blogspot.com", xmlUrl: "https://oldvcr.blogspot.com/feeds/posts/default" },
  { title: "bogdanthegeek.github.io", xmlUrl: "https://bogdanthegeek.github.io/blog/index.xml" },
  { title: "hugotunius.se", xmlUrl: "https://hugotunius.se/feed.xml" },
  { title: "gwern.net", xmlUrl: "https://gwern.substack.com/feed" },
  { title: "berthub.eu", xmlUrl: "https://berthub.eu/articles/index.xml" },
  { title: "chadnauseam.com", xmlUrl: "https://chadnauseam.com/rss.xml" },
  { title: "simone.org", xmlUrl: "https://simone.org/feed/" },
  { title: "it-notes.dragas.net", xmlUrl: "https://it-notes.dragas.net/feed/" },
  { title: "beej.us", xmlUrl: "https://beej.us/blog/rss.xml" },
  { title: "hey.paris", xmlUrl: "https://hey.paris/index.xml" },
  { title: "danielwirtz.com", xmlUrl: "https://danielwirtz.com/rss.xml" },
  { title: "matduggan.com", xmlUrl: "https://matduggan.com/rss/" },
  { title: "refactoringenglish.com", xmlUrl: "https://refactoringenglish.com/index.xml" },
  { title: "worksonmymachine.substack.com", xmlUrl: "https://worksonmymachine.substack.com/feed" },
  { title: "philiplaine.com", xmlUrl: "https://philiplaine.com/index.xml" },
  { title: "steveblank.com", xmlUrl: "https://steveblank.com/feed/" },
  { title: "bernsteinbear.com", xmlUrl: "https://bernsteinbear.com/feed.xml" },
  { title: "danieldelaney.net", xmlUrl: "https://danieldelaney.net/feed" },
  { title: "troyhunt.com", xmlUrl: "https://www.troyhunt.com/rss/" },
  { title: "herman.bearblog.dev", xmlUrl: "https://herman.bearblog.dev/feed/" },
  { title: "tomrenner.com", xmlUrl: "https://tomrenner.com/index.xml" },
  { title: "blog.pixelmelt.dev", xmlUrl: "https://blog.pixelmelt.dev/rss/" },
  { title: "martinalderson.com", xmlUrl: "https://martinalderson.com/feed.xml" },
  { title: "danielchasehooper.com", xmlUrl: "https://danielchasehooper.com/feed.xml" },
  {
    title: "chiark.greenend.org.uk/~sgtatham",
    xmlUrl: "https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/feed.xml",
  },
  { title: "grantslatton.com", xmlUrl: "https://grantslatton.com/rss.xml" },
  { title: "experimental-history.com", xmlUrl: "https://www.experimental-history.com/feed" },
  { title: "anildash.com", xmlUrl: "https://anildash.com/feed.xml" },
  { title: "aresluna.org", xmlUrl: "https://aresluna.org/main.rss" },
  { title: "michael.stapelberg.ch", xmlUrl: "https://michael.stapelberg.ch/feed.xml" },
  { title: "miguelgrinberg.com", xmlUrl: "https://blog.miguelgrinberg.com/feed" },
  { title: "keygen.sh", xmlUrl: "https://keygen.sh/blog/feed.xml" },
  { title: "mjg59.dreamwidth.org", xmlUrl: "https://mjg59.dreamwidth.org/data/rss" },
  { title: "computer.rip", xmlUrl: "https://computer.rip/rss.xml" },
  { title: "tedunangst.com", xmlUrl: "https://www.tedunangst.com/flak/rss" },
]

const CONCURRENCY = 5

async function importFeed(entry: { title: string; xmlUrl: string }): Promise<{
  url: string
  status: "added" | "skipped" | "failed"
  posts: number
  error?: string
}> {
  const { title, xmlUrl } = entry

  // Check if feed already exists
  const existing = await db.query.feeds.findFirst({
    where: eq(feeds.url, xmlUrl),
  })

  if (existing) {
    return { url: xmlUrl, status: "skipped", posts: 0 }
  }

  try {
    const result = await rssManager.fetch(xmlUrl)

    if (!result.success || !result.data) {
      return { url: xmlUrl, status: "failed", posts: 0, error: result.error || "fetch failed" }
    }

    const feedData = result.data

    const [newFeed] = await db
      .insert(feeds)
      .values({
        id: generateSnowflakeId(),
        url: xmlUrl,
        title: feedData.title || title,
        description: feedData.description,
        siteUrl: feedData.siteUrl,
        image: feedData.image,
        language: feedData.language,
        lastBuildDate: feedData.lastBuildDate,
        ttl: feedData.ttl,
        lastFetchedAt: new Date(),
      })
      .returning()

    if (!newFeed) {
      return { url: xmlUrl, status: "failed", posts: 0, error: "db insert failed" }
    }

    // Insert posts (up to 30 per feed)
    const items = feedData.items.slice(0, 30)
    let postCount = 0

    if (items.length > 0) {
      const postsToInsert = items.map((item) => ({
        id: generateSnowflakeId(),
        feedId: newFeed.id,
        guid: item.guid,
        title: item.title,
        url: item.url,
        description: item.description,
        content: item.content,
        author: item.author,
        authorUrl: item.authorUrl,
        authorAvatar: item.authorAvatar,
        publishedAt: item.publishedAt,
        media: item.media,
        attachments: item.attachments,
        categories: item.categories,
        formattedContent: item.formattedContent,
        language: feedData.language,
        extra: item.extra,
      }))

      await db.insert(posts).values(postsToInsert).onConflictDoNothing()
      postCount = items.length
    }

    return { url: xmlUrl, status: "added", posts: postCount }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { url: xmlUrl, status: "failed", posts: 0, error: msg }
  }
}

async function main() {
  console.info(
    `\nImporting ${OPML_FEEDS.length} feeds from OPML (concurrency: ${CONCURRENCY})...\n`,
  )

  let added = 0
  let skipped = 0
  let failed = 0
  let totalPosts = 0

  // Process in batches for controlled concurrency
  for (let i = 0; i < OPML_FEEDS.length; i += CONCURRENCY) {
    const batch = OPML_FEEDS.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map((entry) => importFeed(entry)))

    for (const r of results) {
      if (r.status === "added") {
        added++
        totalPosts += r.posts
        console.info(`  + ${r.url} (${r.posts} posts)`)
      } else if (r.status === "skipped") {
        skipped++
        console.info(`  = ${r.url} (exists)`)
      } else {
        failed++
        console.info(`  x ${r.url} (${r.error})`)
      }
    }

    console.info(`  [${Math.min(i + CONCURRENCY, OPML_FEEDS.length)}/${OPML_FEEDS.length}]`)
  }

  console.info(
    `\nDone: ${added} added, ${skipped} skipped, ${failed} failed, ${totalPosts} posts\n`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
