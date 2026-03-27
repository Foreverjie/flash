import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from scraper.client import NodeApiClient
from scraper.config import settings
from scraper.scrapers.bilibili_up_video import BilibiliUpVideoScraper
from scraper.scrapers.x_timeline import XTimelineScraper

logger = logging.getLogger(__name__)

scrapers = {
    "x_timeline": XTimelineScraper(),
    "bilibili_up_video": BilibiliUpVideoScraper(),
}
node_client = NodeApiClient(
    base_url=settings.node_api_url,
    api_key=settings.internal_api_key,
)


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
            posts = await scraper.scrape(source)
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
