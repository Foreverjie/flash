import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from scraper.client import NodeApiClient
from scraper.config import settings
from scraper.scrapers.base import BaseScraper
from scraper.scrapers.bilibili_up_video import BilibiliUpVideoScraper
from scraper.scrapers.leyoujia_community import LeyoujiaCommunityScraper
from scraper.scrapers.qfang_community import QfangCommunityScraper
from scraper.scrapers.x_timeline import XTimelineScraper

logger = logging.getLogger(__name__)

scrapers = {
    "x_timeline": XTimelineScraper(),
    "bilibili_up_video": BilibiliUpVideoScraper(),
    "leyoujia_community": LeyoujiaCommunityScraper(),
    "qfang_community": QfangCommunityScraper(),
}
node_client = NodeApiClient(
    base_url=settings.node_api_url,
    api_key=settings.internal_api_key,
)


async def run_scraper(
    scraper: BaseScraper,
    client: NodeApiClient,
    feed_id: str,
    source: str,
    force: bool = False,
):
    """Run a scraper, providing feed context (existing guids, force) to adapters
    that diff against already-ingested posts."""
    if not scraper.needs_existing_guids:
        return await scraper.scrape(source)

    try:
        existing_guids = await client.get_feed_guids(feed_id)
    except Exception as exc:
        logger.warning("Could not fetch existing guids for feedId=%s: %s", feed_id, exc)
        existing_guids = None
    return await scraper.scrape(source, existing_guids=existing_guids, force=force)


async def sync_all_feeds() -> None:
    feeds = await node_client.get_scrapling_feeds()
    logger.info("Background sync: %d feeds to scrape", len(feeds))

    for feed in feeds:
        feed_id = feed["feedId"]
        adapter_type = feed["adapterType"]
        source = feed["source"]
        scraper = scrapers.get(adapter_type)
        if scraper is None:
            logger.warning("Skipping unsupported adapter=%s for feedId=%s", adapter_type, feed_id)
            continue
        try:
            posts = await run_scraper(scraper, node_client, feed_id, source)
            if posts:
                inserted = await node_client.ingest_posts(feed_id=feed_id, posts=posts)
                logger.info("%s:%s: %d new posts", adapter_type, source, inserted)
        except Exception as exc:
            logger.error(
                "Failed to sync %s:%s (feedId=%s): %s",
                adapter_type,
                source,
                feed_id,
                exc,
            )


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        sync_all_feeds,
        trigger="interval",
        minutes=settings.scrape_interval_minutes,
        id="sync_all_feeds",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started: sync every %d min", settings.scrape_interval_minutes)
    return scheduler
