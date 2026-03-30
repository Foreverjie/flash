import pytest
from pydantic import ValidationError

from scraper.models import ScrapedPost


def test_scraped_post_requires_guid():
    with pytest.raises(ValidationError):
        ScrapedPost(title="hi", url="https://x.com/foo/1", content="hi",
                    published_at="2026-01-01T00:00:00Z", author="foo")


def test_scraped_post_title_truncated_to_100_chars():
    long_text = "a" * 200
    post = ScrapedPost(
        guid="https://x.com/foo/status/1",
        title=long_text,  # pass the full 200-char string — validator must truncate it
        url="https://x.com/foo/status/1",
        content=long_text,
        published_at="2026-01-01T00:00:00Z",
        author="foo",
    )
    assert len(post.title) == 100


def test_scraped_post_media_defaults_to_empty_list():
    post = ScrapedPost(
        guid="https://x.com/foo/status/1",
        title="Hello",
        url="https://x.com/foo/status/1",
        content="Hello world",
        published_at="2026-01-01T00:00:00Z",
        author="foo",
    )
    assert post.media == []
    assert post.attachments == []
