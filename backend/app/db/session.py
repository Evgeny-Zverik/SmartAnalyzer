from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base

_kwargs = {}
if settings.database_url:
    if settings.database_url.startswith("sqlite"):
        _kwargs["connect_args"] = {"check_same_thread": False}
    else:
        _kwargs["pool_pre_ping"] = True

engine = create_engine(settings.database_url, **_kwargs) if settings.database_url else None
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) if engine else None


def ensure_tables() -> None:
    if engine is None:
        return
    import app.models.user  # noqa: F401
    import app.models.document  # noqa: F401
    import app.models.document_analysis  # noqa: F401
    import app.models.usage_log  # noqa: F401
    Base.metadata.create_all(bind=engine)


def get_db():
    if SessionLocal is None:
        raise RuntimeError("Database is not configured. Set DATABASE_URL in .env")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
