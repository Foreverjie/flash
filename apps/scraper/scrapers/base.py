from abc import ABC, abstractmethod

from scraper.models import ScrapedPost


class BaseScraper(ABC):
    @abstractmethod
    async def scrape(self, handle: str) -> list[ScrapedPost]:
        """Scrape content for the given handle. Returns empty list on failure."""
        ...
