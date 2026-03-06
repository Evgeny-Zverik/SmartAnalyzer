from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

_kwargs = {}
if settings.database_url:
    if settings.database_url.startswith("sqlite"):
        _kwargs["connect_args"] = {"check_same_thread": False}
    else:
        _kwargs["pool_pre_ping"] = True

engine = create_engine(settings.database_url, **_kwargs) if settings.database_url else None
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) if engine else None


def check_database_connection() -> bool:
    if engine is None:
        return False
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def get_db():
    if SessionLocal is None:
        raise RuntimeError("Database is not configured. Set DATABASE_URL in .env")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
