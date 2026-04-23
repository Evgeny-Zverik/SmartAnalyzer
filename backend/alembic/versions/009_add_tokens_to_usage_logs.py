"""add tokens_in/tokens_out to usage_logs

Revision ID: 009
Revises: 008
Create Date: 2026-04-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: str | None = "008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "usage_logs",
        sa.Column("tokens_in", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "usage_logs",
        sa.Column("tokens_out", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("usage_logs", "tokens_out")
    op.drop_column("usage_logs", "tokens_in")
