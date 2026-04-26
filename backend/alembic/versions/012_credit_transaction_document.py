"""add document_id and pages to credit transactions

Revision ID: 012
Revises: 011
Create Date: 2026-04-26

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "012"
down_revision: str | None = "011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "credit_transactions",
        sa.Column("document_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "credit_transactions",
        sa.Column("pages", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_credit_transactions_document_id"),
        "credit_transactions",
        ["document_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_credit_transactions_document_id"), table_name="credit_transactions")
    op.drop_column("credit_transactions", "pages")
    op.drop_column("credit_transactions", "document_id")
