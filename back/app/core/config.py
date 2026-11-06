"""Configuration applicative centralisée (Pydantic Settings v2)."""
from __future__ import annotations

from functools import lru_cache
from typing import Any, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # ---------- Application ----------
    APP_NAME: str = "ImmoFlow AI API"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Literal["development", "staging", "production", "test"] = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000

    # ---------- Sécurité ----------
    SECRET_KEY: str = "insecure-dev-key-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 60
    BCRYPT_ROUNDS: int = 12

    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    ALLOWED_HOSTS: list[str] = ["*"]

    # ---------- PostgreSQL ----------
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "immoflow"
    POSTGRES_PASSWORD: str = "immoflow"
    POSTGRES_DB: str = "immoflow"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False
    DATABASE_URL_OVERRIDE: str | None = None

    # ---------- Redis ----------
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str | None = None

    # ---------- Stockage ----------
    STORAGE_BACKEND: Literal["local", "s3"] = "local"
    UPLOAD_DIR: str = "./storage"
    MAX_UPLOAD_SIZE_MB: int = 25
    PUBLIC_BASE_URL: str = "http://localhost:8000"

    # ---------- Email ----------
    SMTP_ENABLED: bool = False
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_TLS: bool = True
    EMAIL_FROM: str = "no-reply@immoflow.ai"
    EMAIL_FROM_NAME: str = "ImmoFlow AI"
    FRONTEND_BASE_URL: str = "http://localhost:5173"

    # ---------- IA ----------
    AI_PROVIDER: Literal["none", "openai", "groq", "anthropic"] = "none"
    AI_API_KEY: str | None = None
    AI_MODEL: str = "gpt-4o-mini"
    AI_TIMEOUT_SECONDS: int = 45

    # ---------- Rate limiting ----------
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 120

    # ---------- Bootstrap ----------
    # Crée le Super Admin et les types de biens au démarrage s'ils manquent.
    # Évite le cas — signalé en pratique — où les migrations sont appliquées
    # sans que `python -m app.database.init_db` ait été lancé.
    AUTO_INIT_DB: bool = True

    FIRST_SUPERADMIN_EMAIL: str = "admin@immoflow.ai"
    FIRST_SUPERADMIN_PASSWORD: str = "ChangeMe123!"

    # ---------- Pagination ----------
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    @field_validator("BACKEND_CORS_ORIGINS", "ALLOWED_HOSTS", mode="before")
    @classmethod
    def _split_list(cls, v: Any) -> Any:
        if isinstance(v, str) and not v.startswith("["):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v

    # ---------- Propriétés dérivées ----------
    @property
    def database_url(self) -> str:
        if self.DATABASE_URL_OVERRIDE:
            return self.DATABASE_URL_OVERRIDE
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def sync_database_url(self) -> str:
        """URL synchrone utilisée par Alembic."""
        return self.database_url.replace("+asyncpg", "+psycopg2").replace(
            "+aiosqlite", ""
        )

    @property
    def redis_url(self) -> str:
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
