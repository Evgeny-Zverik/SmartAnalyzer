"""add plugin execution and workspace plugin tables

Revision ID: 006
Revises: 005
Create Date: 2026-03-11

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: str | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "plugin_executions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("plugin_id", sa.String(length=64), nullable=False),
        sa.Column("plugin_version", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("result_json", sa.JSON(), nullable=True),
        sa.Column("error_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plugin_executions_user_id", "plugin_executions", ["user_id"], unique=False)
    op.create_index("ix_plugin_executions_document_id", "plugin_executions", ["document_id"], unique=False)
    op.create_index("ix_plugin_executions_plugin_id", "plugin_executions", ["plugin_id"], unique=False)

    op.create_table(
        "workspace_enabled_plugins",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("workspace_type", sa.String(length=32), nullable=False),
        sa.Column("workspace_entity_id", sa.Integer(), nullable=False),
        sa.Column("plugin_id", sa.String(length=64), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "workspace_type", "workspace_entity_id", "plugin_id", name="uq_workspace_plugin"),
    )
    op.create_index("ix_workspace_enabled_plugins_user_id", "workspace_enabled_plugins", ["user_id"], unique=False)
    op.create_index("ix_workspace_enabled_plugins_workspace_type", "workspace_enabled_plugins", ["workspace_type"], unique=False)
    op.create_index("ix_workspace_enabled_plugins_workspace_entity_id", "workspace_enabled_plugins", ["workspace_entity_id"], unique=False)
    op.create_index("ix_workspace_enabled_plugins_plugin_id", "workspace_enabled_plugins", ["plugin_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_workspace_enabled_plugins_plugin_id", table_name="workspace_enabled_plugins")
    op.drop_index("ix_workspace_enabled_plugins_workspace_entity_id", table_name="workspace_enabled_plugins")
    op.drop_index("ix_workspace_enabled_plugins_workspace_type", table_name="workspace_enabled_plugins")
    op.drop_index("ix_workspace_enabled_plugins_user_id", table_name="workspace_enabled_plugins")
    op.drop_table("workspace_enabled_plugins")

    op.drop_index("ix_plugin_executions_plugin_id", table_name="plugin_executions")
    op.drop_index("ix_plugin_executions_document_id", table_name="plugin_executions")
    op.drop_index("ix_plugin_executions_user_id", table_name="plugin_executions")
    op.drop_table("plugin_executions")
