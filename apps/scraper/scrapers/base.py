from abc import ABC, abstractmethod

from scraper.models import ScrapedPost


class BaseScraper(ABC):
    @abstractmethod
    async def scrape(self, source: str) -> list[ScrapedPost]:
        """Scrape content for the given source identifier. Returns empty list on failure."""
        ...
