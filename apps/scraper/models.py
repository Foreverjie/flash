from typing import Literal

from pydantic import BaseModel, field_validator


class ScrapedPost(BaseModel):
    guid: str                    # stable unique identifier
    title: str                   # first ≤100 chars of text
    url: str                     # source URL
    content: str                 # full text content
    published_at: str            # ISO 8601
    author: str                  # creator handle
    media: list[dict] = []       # [{"url": str, "type": "photo"|"video"}]
    attachments: list[dict] = [] # [{"url": str, "mime_type": str, "duration_in_seconds": int}]

    @field_validator("title")
    @classmethod
    def truncate_title(cls, v: str) -> str:
        return v[:100]


class IngestRequest(BaseModel):
    feed_id: str
    posts: list[ScrapedPost]


class ScrapeRequest(BaseModel):
    feed_id: str
    adapter_type: Literal["x_timeline", "bilibili_up_video"]
    source: str
