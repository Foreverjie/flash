import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from scraper.client import NodeApiClient
from scraper.config import settings
from scraper.scrapers.x_timeline import XTimelineScraper

logger = logging.getLogger(__name__)

scraper = XTimelineScraper()
node_client = NodeApiClient(
    base_url=settings.node_api_url,
    api_key=settings.internal_api_key,
)


async def sync_all_feeds() -> None:
    feeds = await node_client.get_scrapling_feeds()
    logger.info("Background sync: %d feeds to scrape", len(feeds))

    for feed in feeds:
        feed_id = feed["feedId"]
        handle = feed["handle"]
        try:
            posts = await scraper.scrape(handle)
            if posts:
                inserted = await node_client.ingest_posts(feed_id=feed_id, posts=posts)
                logger.info("@%s: %d new posts", handle, inserted)
        except Exception as exc:
            logger.error("Failed to sync @%s (feedId=%s): %s", handle, feed_id, exc)


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
