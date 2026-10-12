from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_expires_minutes: int = 60 * 24 * 7
    cors_origins: str = ""

    @field_validator("jwt_secret")
    @classmethod
    def secret_long_enough(cls, v: str) -> str:
        if len(v) < 16:
            raise ValueError("JWT_SECRET должен быть не короче 16 символов")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
