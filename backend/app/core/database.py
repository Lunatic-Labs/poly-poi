from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Tuned for Supabase's transaction pooler (port 6543):
#   - NullPool: don't double-pool — Supabase pools on its end, SQLAlchemy keeping
#     idle connections just wastes pooler slots
#   - statement_cache_size=0: transaction pooler doesn't preserve prepared
#     statements across queries (each query may hit a different backend
#     connection), so asyncpg's default cache breaks
engine = create_async_engine(
    settings.database_url,
    echo=False,
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0},
)
_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory() as session:
        yield session
