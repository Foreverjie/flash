from pydantic import BaseModel, field_validator


class ScrapedPost(BaseModel):
    guid: str                    # tweet URL — stable unique identifier
    title: str                   # first ≤100 chars of tweet text
    url: str                     # tweet URL
    content: str                 # full tweet text
    published_at: str            # ISO 8601
    author: str                  # @handle (without @)
    media: list[dict] = []       # [{"url": str, "type": "image"|"video"}]

    @field_validator("title")
    @classmethod
    def truncate_title(cls, v: str) -> str:
        return v[:100]


class IngestRequest(BaseModel):
    feed_id: str
    posts: list[ScrapedPost]


class ScrapeRequest(BaseModel):
    feed_id: str
    handle: str
