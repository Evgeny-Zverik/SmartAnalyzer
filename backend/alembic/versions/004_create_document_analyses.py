"""create document_analyses table

Revision ID: 004
Revises: 003
Create Date: 2025-03-05

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "document_analyses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("tool_slug", sa.String(64), nullable=False),
        sa.Column("result_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
    )
    op.create_index(op.f("ix_document_analyses_user_id"), "document_analyses", ["user_id"], unique=False)
    op.create_index(op.f("ix_document_analyses_document_id"), "document_analyses", ["document_id"], unique=False)
    op.create_index(op.f("ix_document_analyses_tool_slug"), "document_analyses", ["tool_slug"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_document_analyses_tool_slug"), table_name="document_analyses")
    op.drop_index(op.f("ix_document_analyses_document_id"), table_name="document_analyses")
    op.drop_index(op.f("ix_document_analyses_user_id"), table_name="document_analyses")
    op.drop_table("document_analyses")
