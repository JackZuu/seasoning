import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./seasoning.db")

# Railway Postgres sets postgresql:// but SQLAlchemy async requires postgresql+asyncpg://
if _url.startswith("postgresql://"):
    _url = _url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


def _add_column_if_missing(conn, table_name: str, column_name: str, column_type: str):
    """Safely add a column to an existing table (works on SQLite + Postgres)."""
    from sqlalchemy import inspect, text
    inspector = inspect(conn)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    if column_name not in columns:
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))
        print(f"  Added column {table_name}.{column_name}")


def _run_migrations(conn):
    """Add any new columns that don't exist yet."""
    _add_column_if_missing(conn, "recipes", "image_url", "TEXT")
    _add_column_if_missing(conn, "recipes", "notes", "TEXT DEFAULT ''")


async def init_db():
    """Create all tables on startup if they don't exist, then run migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_run_migrations)
