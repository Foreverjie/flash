import httpx

from scraper.models import ScrapedPost


class NodeApiClient:
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        self._base_url = base_url.rstrip("/")
        self._headers = {"x-internal-key": api_key, "content-type": "application/json"}
        self._timeout = timeout

    async def get_scrapling_feeds(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=self._timeout) as http:
            resp = await http.get(
                f"{self._base_url}/internal/scrapling/feeds",
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json().get("data", [])

    async def ingest_posts(self, feed_id: str, posts: list[ScrapedPost]) -> int:
        payload = {
            "feedId": feed_id,
            "posts": [p.model_dump(by_alias=False) for p in posts],
        }
        async with httpx.AsyncClient(timeout=self._timeout) as http:
            resp = await http.post(
                f"{self._base_url}/internal/scrapling/ingest",
                json=payload,
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json().get("data", {}).get("inserted", 0)
