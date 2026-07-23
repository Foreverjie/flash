from typing import Literal

from pydantic import BaseModel, field_validator


class PropertyInfo(BaseModel):
    """Structured second-hand listing data behind the Property Feed card.

    This is the mandatory field for community (real-estate) adapters: it carries
    the facts the card renders — price, area, layout, location, badges — as data
    rather than baked-only-into-HTML, so any client can render a native card.
    """

    community: str
    title: str = ""          # listing headline, e.g. "南向精装三房，近地铁"
    city: str = ""
    hood: str = ""
    beds: int = 0
    halls: int = 0
    baths: int = 0
    area: float = 0
    total: str = ""          # display price, e.g. "780万"
    total_num: float = 0     # numeric price in yuan, for sorting
    unit: str = ""           # display unit price, e.g. "单价41684元/㎡"
    unit_num: float = 0      # numeric price per m², for sorting
    floor: str = ""
    orientation: str = ""
    reno: str = ""
    tags: list[str] = []
    badge: str = ""          # "new" | "reduced" | ""
    reduced_by: str = ""
    orig: str = ""
    sold: bool = False
    image: str = ""


class ScrapedPost(BaseModel):
    guid: str                    # stable unique identifier
    title: str                   # first ≤100 chars of text
    url: str                     # source URL
    content: str                 # full text content
    published_at: str            # ISO 8601
    author: str                  # creator handle
    media: list[dict] = []       # [{"url": str, "type": "photo"|"video"}]
    attachments: list[dict] = [] # [{"url": str, "mime_type": str, "duration_in_seconds": int}]
    property: PropertyInfo | None = None  # required for community listing adapters

    @field_validator("title")
    @classmethod
    def truncate_title(cls, v: str) -> str:
        return v[:100]


class IngestRequest(BaseModel):
    feed_id: str
    posts: list[ScrapedPost]


class ScrapeRequest(BaseModel):
    feed_id: str
    adapter_type: Literal[
        "x_timeline",
        "bilibili_up_video",
        "leyoujia_community",
        "qfang_community",
    ]
    source: str
