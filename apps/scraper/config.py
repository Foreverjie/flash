from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    node_api_url: str = "http://localhost:3001"
    internal_api_key: str = "dev-secret"
    scrape_interval_minutes: int = 15
    scrape_timeout_seconds: int = 30
    bilibili_cookie: str = ""
    community_min_scrape_interval_minutes: int = 360
    # Bilibili risk-control bans an IP after only a couple of rapid requests,
    # and retrying while banned keeps renewing it. Scrape rarely, and back off
    # hard once rejected.
    bilibili_min_scrape_interval_minutes: int = 360
    bilibili_backoff_minutes: int = 720

    class Config:
        env_file = ".env"


settings = Settings()
