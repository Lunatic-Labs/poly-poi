from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # Database (direct connection for SQLAlchemy)
    database_url: str  # postgresql+asyncpg://...

    # OpenAI
    openai_api_key: str

    # App
    app_env: str = "development"
    app_base_url: str = "http://localhost:8000"
    visitor_app_base_url: str = "http://localhost:5173"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
