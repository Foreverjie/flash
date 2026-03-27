import pytest
import httpx
import respx

from scraper.client import NodeApiClient
from scraper.models import ScrapedPost


@pytest.fixture
def client():
    return NodeApiClient(base_url="http://test-api", api_key="test-key")


@respx.mock
@pytest.mark.asyncio
async def test_get_scrapling_feeds_returns_list(client):
    respx.get("http://test-api/internal/scrapling/feeds").mock(
        return_value=httpx.Response(
            200,
            json={"data": [{"feedId": "1", "adapterType": "x_timeline", "source": "foo"}]},
        )
    )
    feeds = await client.get_scrapling_feeds()
    assert feeds == [{"feedId": "1", "adapterType": "x_timeline", "source": "foo"}]


@respx.mock
@pytest.mark.asyncio
async def test_ingest_posts_returns_inserted_count(client):
    post = ScrapedPost(
        guid="https://x.com/foo/status/1",
        title="Hello",
        url="https://x.com/foo/status/1",
        content="Hello world",
        published_at="2026-01-01T00:00:00Z",
        author="foo",
    )
    respx.post("http://test-api/internal/scrapling/ingest").mock(
        return_value=httpx.Response(200, json={"data": {"inserted": 1}})
    )
    result = await client.ingest_posts(feed_id="1", posts=[post])
    assert result == 1


@respx.mock
@pytest.mark.asyncio
async def test_get_scrapling_feeds_sends_auth_header(client):
    route = respx.get("http://test-api/internal/scrapling/feeds").mock(
        return_value=httpx.Response(200, json={"data": []})
    )
    await client.get_scrapling_feeds()
    assert route.calls[0].request.headers["x-internal-key"] == "test-key"
