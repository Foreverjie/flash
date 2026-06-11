from unittest.mock import AsyncMock

import pytest
from scrapling.parser import Adaptor

from scraper.scrapers.qfang_community import QfangCommunityScraper, _page_count

# Mirrors the real Nuxt SSR markup of https://shenzhen.qfang.com/garden/sale/{id},
# including the footer link cloud of other communities (no .show-image).
FIXTURE = """
<html><body>
<h2 class="house-title">中信红树湾</h2>
<ul>
  <li>
    <a target="_blank" href="/sale/505019201" class="show-image">
      <img alt="中信红树湾 4室2厅167.56m²满五年" src="https://img.qfangimg.com/a.jpg-240x180" class="img">
    </a>
    <div class="show-detail">
      <p class="house-title"><a target="_blank" href="/sale/505019201">
        中信红树湾 4室2厅167.56m²满五年
      </a></p>
      <p class="house-about"><span>4室2厅</span> <span>167.56平米</span> <span>精装</span> <span>高层（共31层）</span></p>
    </div>
    <div class="show-price"><span class="sale-price">3200</span><span class="sale-unit">万</span> <p>190976元/平米</p></div>
  </li>
  <li>
    <a target="_blank" href="/sale/425863" class="show-image"><img alt="" src="" class="img"></a>
    <div class="show-detail">
      <p class="house-title"><a target="_blank" href="/sale/425863">中信红树湾 3室 64.55㎡</a></p>
      <p class="house-about"><span>3室0厅</span> <span>64.55平米</span></p>
    </div>
    <div class="show-price"><span class="sale-price">337</span><span class="sale-unit">万</span> <p>52200元/平米</p></div>
  </li>
</ul>
<div class="pagination-container">
  <button class="button prev disable"><span class="text">上一页</span></button>
  <span class="items active">1</span><a href="javascript:;" class="items">2</a>
  <button class="button next"><span class="text">下一页</span></button>
</div>
<div class="tabs-box"><div class="items clearfix">
  <a href="https://shenzhen.qfang.com/garden/sale/58614" target="_blank">鸿翔花园二手房</a>
</div></div>
</body></html>
"""

SECOND_PAGE = """
<html><body>
<h2 class="house-title">中信红树湾</h2>
<ul>
  <li>
    <a target="_blank" href="/sale/777001" class="show-image"><img src="" class="img"></a>
    <div class="show-detail">
      <p class="house-title"><a target="_blank" href="/sale/777001">中信红树湾 2室 80㎡</a></p>
      <p class="house-about"><span>2室1厅</span></p>
    </div>
    <div class="show-price"><span class="sale-price">800</span> <p>100000元/平米</p></div>
  </li>
</ul>
</body></html>
"""


def test_page_count():
    assert _page_count(Adaptor(text=FIXTURE)) == 2
    assert _page_count(Adaptor(text=SECOND_PAGE)) == 1


@pytest.mark.asyncio
async def test_scrape_walks_all_pages_and_parses_listings():
    scraper = QfangCommunityScraper()
    scraper._fetch_page = AsyncMock(
        side_effect=[Adaptor(text=FIXTURE), Adaptor(text=SECOND_PAGE)]
    )

    posts = await scraper.scrape("57558", existing_guids=None, force=True)

    assert [p.guid for p in posts] == ["505019201@3200", "425863@337", "777001@800"]
    first = posts[0]
    assert first.title == "中信红树湾 4室2厅167.56m²满五年"
    assert first.url == "https://shenzhen.qfang.com/sale/505019201"
    assert first.author == "中信红树湾"
    assert "3200万" in first.content
    assert "4室2厅 · 167.56平米 · 精装 · 高层（共31层）" in first.content
    assert first.media == [{"url": "https://img.qfangimg.com/a.jpg-240x180", "type": "photo"}]
    assert scraper._fetch_page.await_count == 2


@pytest.mark.asyncio
async def test_scrape_labels_price_changes():
    scraper = QfangCommunityScraper()
    scraper._fetch_page = AsyncMock(
        side_effect=[Adaptor(text=FIXTURE), Adaptor(text=SECOND_PAGE)]
    )

    posts = await scraper.scrape(
        "57558",
        existing_guids=["505019201@3500", "425863@337", "777001@800"],
        force=True,
    )

    assert posts[0].title.startswith("📉 降价 3500万→3200万 | ")
    assert posts[1].title == "中信红树湾 3室 64.55㎡"
    assert posts[2].title == "中信红树湾 2室 80㎡"


@pytest.mark.asyncio
async def test_scrape_returns_empty_on_fetch_failure():
    scraper = QfangCommunityScraper()
    scraper._fetch_page = AsyncMock(side_effect=RuntimeError("HTTP 502"))
    assert await scraper.scrape("57558", force=True) == []
