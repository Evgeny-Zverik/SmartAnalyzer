"""create user_feature_flags table

Revision ID: 008
Revises: 007
Create Date: 2026-03-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: str | None = "007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_feature_flags",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("feature_key", sa.String(length=128), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "feature_key", name="uq_user_feature_flag"),
    )
    op.create_index("ix_user_feature_flags_user_id", "user_feature_flags", ["user_id"], unique=False)
    op.create_index("ix_user_feature_flags_feature_key", "user_feature_flags", ["feature_key"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_feature_flags_feature_key", table_name="user_feature_flags")
    op.drop_index("ix_user_feature_flags_user_id", table_name="user_feature_flags")
    op.drop_table("user_feature_flags")
