from abc import ABC, abstractmethod

from scraper.models import ScrapedPost


class BaseScraper(ABC):
    # Adapters that diff against already-ingested posts set this to True and
    # accept scrape(source, existing_guids=..., force=...).
    needs_existing_guids: bool = False

    @abstractmethod
    async def scrape(self, source: str) -> list[ScrapedPost]:
        """Scrape content for the given source identifier. Returns empty list on failure."""
        ...
