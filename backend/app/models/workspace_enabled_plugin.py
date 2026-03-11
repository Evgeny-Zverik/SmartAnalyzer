from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WorkspaceEnabledPlugin(Base):
    __tablename__ = "workspace_enabled_plugins"
    __table_args__ = (
        UniqueConstraint("user_id", "workspace_type", "workspace_entity_id", "plugin_id", name="uq_workspace_plugin"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    workspace_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    workspace_entity_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    plugin_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
