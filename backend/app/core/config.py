from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .env.local lives at the project root (matches docker-compose env_file and `make setup`).
# Resolve from this file's location so the lookup works regardless of CWD —
# `make backend` cds into backend/, but uvicorn could also be launched from root.
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env.local"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str  # kept for config parity; auth uses JWKS (ES256)

    # Database (direct connection for SQLAlchemy)
    database_url: str  # postgresql+asyncpg://...

    # OpenAI
    openai_api_key: str

    # Hume.ai (TTS + Voice Design)
    hume_api_key: str

    # App
    app_env: str = "development"
    app_base_url: str = "http://localhost:8000"
    visitor_app_base_url: str = "http://localhost:5173"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
