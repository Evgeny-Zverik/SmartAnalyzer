"""add credit balance and transactions

Revision ID: 011
Revises: 010
Create Date: 2026-04-25

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: str | None = "010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("credit_balance", sa.Integer(), nullable=False, server_default="100"),
    )
    op.add_column(
        "usage_logs",
        sa.Column("credits_charged", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "credit_transactions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(64), nullable=False),
        sa.Column("reference", sa.String(128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_credit_transactions_user_id"),
        "credit_transactions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_credit_transactions_reason"),
        "credit_transactions",
        ["reason"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_credit_transactions_reason"), table_name="credit_transactions")
    op.drop_index(op.f("ix_credit_transactions_user_id"), table_name="credit_transactions")
    op.drop_table("credit_transactions")
    op.drop_column("usage_logs", "credits_charged")
    op.drop_column("users", "credit_balance")
