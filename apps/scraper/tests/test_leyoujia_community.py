from unittest.mock import AsyncMock, patch

import pytest
from scrapling.parser import Adaptor

from scraper.scrapers.community_base import parse_source
from scraper.scrapers.leyoujia_community import LeyoujiaCommunityScraper

# Mirrors the real markup of https://shenzhen.leyoujia.com/xq/detail/esf/{id},
# including the right-box 周边二手房 sidebar whose items belong to other communities.
FIXTURE = """
<html><body>
<div class="comm-box container clearfix">
  <div class="left-box">
    <div class="list-box">
      <ul>
        <li class="item clearfix">
          <div class="img">
            <a href="/esf/detail/AAA111" target="_blank">
              <img class="lazy" data-original="https://img.leyoujia.com/a.jpg?imageView2/2/w/400">
            </a>
          </div>
          <div class="text">
            <p class="tit"><a href="/esf/detail/AAA111" title="龙岗大运中海康城花园3室2厅，人车分流">龙岗大运中海康城花园3室2厅，人车分流</a></p>
            <p class="attr">中海康城花园 <em class="line">|</em> 普通住宅 <em class="line">|</em> 建筑面积88.99㎡</p>
            <p class="attr">西南 <em class="line">|</em> 精装 <em class="line">|</em> 中楼层(共33层) <em class="line">|</em> 2009年建成</p>
            <p class="attr">龙岗-大运 <em class="line">|</em> 距16号线黄阁坑站 1136米</p>
            <p class="labs clearfix"><span class="lab">满五年</span> <span class="lab">红本在手</span></p>
          </div>
          <div class="price">
            <p class="sup"><span class="salePrice">243</span>万</p>
            <p class="sub">单价27306元/㎡</p>
          </div>
        </li>
        <li class="item clearfix">
          <div class="img"><a href="/esf/detail/BBB222"><img class="lazy"></a></div>
          <div class="text">
            <p class="tit"><a href="/esf/detail/BBB222" title="中海康城花园4室2厅，高楼层">中海康城花园4室2厅，高楼层</a></p>
            <p class="attr">中海康城花园 <em class="line">|</em> 普通住宅 <em class="line">|</em> 建筑面积120.5㎡</p>
            <p class="labs clearfix"></p>
          </div>
          <div class="price">
            <p class="sup"><span class="salePrice">510</span>万</p>
            <p class="sub">单价42323元/㎡</p>
          </div>
        </li>
      </ul>
    </div>
  </div>
  <div class="right-box">
    <div class="nearby">
      <ul>
        <li class="item on">
          <div class="img"><a href="/esf/detail/NEARBY1"><img></a></div>
          <div class="text"><span><a href="/esf/detail/NEARBY1">阳光天健城</a></span></div>
        </li>
      </ul>
    </div>
  </div>
</div>
</body></html>
"""


def _scraper_with_fixture() -> LeyoujiaCommunityScraper:
    scraper = LeyoujiaCommunityScraper()
    scraper._fetch_page = AsyncMock(return_value=Adaptor(text=FIXTURE))
    return scraper


def test_parse_source():
    assert parse_source("9575") == ("shenzhen", "9575")
    assert parse_source("guangzhou:123") == ("guangzhou", "123")
    with pytest.raises(ValueError):
        parse_source("evil.com/9575")
    with pytest.raises(ValueError):
        parse_source("9575; rm -rf /")


@pytest.mark.asyncio
async def test_scrape_parses_listings_and_skips_sidebar():
    scraper = _scraper_with_fixture()
    posts = await scraper.scrape("9575", existing_guids=None, force=True)

    assert [p.guid for p in posts] == ["AAA111@243", "BBB222@510"]
    first = posts[0]
    assert first.url == "https://shenzhen.leyoujia.com/esf/detail/AAA111"
    assert first.author == "中海康城花园"
    assert "243万" in first.content
    assert "88.99㎡" in first.content
    assert first.media == [{"url": "https://img.leyoujia.com/a.jpg", "type": "photo"}]
    # Rendered as a property card: hero image + original headline kept for context
    assert first.content.startswith("<div ")
    assert 'src="https://img.leyoujia.com/a.jpg"' in first.content
    assert "龙岗大运中海康城花园3室2厅，人车分流" in first.content
    # Without guid context, titles are unlabeled and lead with price · area · layout
    assert first.title == "243万 · 88.99㎡ · 3室2厅"
    # Mandatory structured property field
    pr = first.property
    assert pr is not None
    assert (pr.community, pr.beds, pr.halls, pr.area) == ("中海康城花园", 3, 2, 88.99)
    assert pr.total == "243万" and pr.total_num == 2430000
    assert pr.unit_num == 27306 and pr.orientation == "西南" and pr.reno == "精装"
    assert pr.city == "深圳"


@pytest.mark.asyncio
async def test_scrape_labels_new_listings_and_price_changes():
    scraper = _scraper_with_fixture()
    # BBB222 was last seen at 530万; AAA111 has never been seen
    posts = await scraper.scrape("9575", existing_guids=["BBB222@530"], force=True)

    assert posts[0].title.startswith("🆕 新上 | ")
    assert posts[0].property.badge == "new"
    assert posts[1].title.startswith("📉 降价 530万→510万 | ")
    # Price drop surfaces as a card badge + struck original price
    assert posts[1].property.badge == "reduced"
    assert "降价 20万" in posts[1].content
    assert "530万" in posts[1].content


@pytest.mark.asyncio
async def test_scrape_uses_latest_price_for_relisted_property():
    scraper = _scraper_with_fixture()
    # Newest-first guid order: latest known price for BBB222 is 500, not 530
    posts = await scraper.scrape("9575", existing_guids=["BBB222@500", "BBB222@530"], force=True)
    assert posts[1].title.startswith("📈 涨价 500万→510万 | ")


@pytest.mark.asyncio
async def test_scrape_unchanged_price_keeps_neutral_title():
    scraper = _scraper_with_fixture()
    posts = await scraper.scrape("9575", existing_guids=["AAA111@243", "BBB222@510"], force=True)
    assert posts[0].title == "243万 · 88.99㎡ · 3室2厅"
    assert posts[1].title == "510万 · 120.5㎡ · 4室2厅"


@pytest.mark.asyncio
async def test_scheduler_runs_are_throttled():
    scraper = _scraper_with_fixture()

    first = await scraper.scrape("9575", existing_guids=[])
    assert len(first) == 2

    second = await scraper.scrape("9575", existing_guids=[])
    assert second == []

    forced = await scraper.scrape("9575", existing_guids=[], force=True)
    assert len(forced) == 2


@pytest.mark.asyncio
async def test_scrape_returns_empty_on_invalid_source():
    scraper = LeyoujiaCommunityScraper()
    assert await scraper.scrape("not-a-community") == []


@pytest.mark.asyncio
async def test_scrape_returns_empty_on_fetch_failure():
    scraper = LeyoujiaCommunityScraper()
    scraper._fetch_page = AsyncMock(side_effect=RuntimeError("HTTP 403"))
    assert await scraper.scrape("9575", force=True) == []
