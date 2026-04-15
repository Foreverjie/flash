from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    node_api_url: str = "http://localhost:3001"
    internal_api_key: str = "dev-secret"
    scrape_interval_minutes: int = 15
    scrape_timeout_seconds: int = 30
    bilibili_cookie: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
