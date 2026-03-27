import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException

from scraper.client import NodeApiClient
from scraper.config import settings
from scraper.models import ScrapeRequest
from scraper.scheduler import start_scheduler
from scraper.scrapers.bilibili_up_video import BilibiliUpVideoScraper
from scraper.scrapers.x_timeline import XTimelineScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    _scheduler = start_scheduler()
    yield
    if _scheduler:
        _scheduler.shutdown()


app = FastAPI(title="Scrapling Service", lifespan=lifespan)

scrapers = {
    "x_timeline": XTimelineScraper(),
    "bilibili_up_video": BilibiliUpVideoScraper(),
}
node_client = NodeApiClient(
    base_url=settings.node_api_url,
    api_key=settings.internal_api_key,
    timeout=settings.scrape_timeout_seconds,
)


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/scrape")
async def scrape(req: ScrapeRequest, x_internal_key: str = Header(None)):
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        scraper = scrapers.get(req.adapter_type)
        if scraper is None:
            raise RuntimeError(f"Unsupported adapter type: {req.adapter_type}")

        posts = await scraper.scrape(req.source)
        inserted = 0
        if posts:
            inserted = await node_client.ingest_posts(feed_id=req.feed_id, posts=posts)
        elif req.source:
            raise RuntimeError("No posts returned from scraper")
        logger.info(
            "Scraped %s source=%s: %d new posts inserted",
            req.adapter_type,
            req.source,
            inserted,
        )
        return {"inserted": inserted}
    except Exception as exc:
        logger.error(
            "Scrape request failed for %s source=%s: %s",
            req.adapter_type,
            req.source,
            exc,
        )
        raise HTTPException(
            status_code=502,
            detail=f"Scrape failed for {req.adapter_type}:{req.source}: {exc}",
        ) from exc
