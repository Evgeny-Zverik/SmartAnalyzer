"""create vouchers and voucher redemptions

Revision ID: 013
Revises: 012
Create Date: 2026-04-26

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "013"
down_revision: str | None = "012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "vouchers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("credits", sa.Integer(), nullable=False),
        sa.Column("usage_limit", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bound_user_id", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["bound_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_vouchers_code"),
    )
    op.create_index(op.f("ix_vouchers_code"), "vouchers", ["code"], unique=True)
    op.create_index(
        op.f("ix_vouchers_bound_user_id"), "vouchers", ["bound_user_id"], unique=False
    )

    op.create_table(
        "voucher_redemptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("voucher_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("credits_granted", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["voucher_id"], ["vouchers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "voucher_id", "user_id", name="uq_voucher_redemptions_voucher_user"
        ),
    )
    op.create_index(
        op.f("ix_voucher_redemptions_voucher_id"),
        "voucher_redemptions",
        ["voucher_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_voucher_redemptions_user_id"),
        "voucher_redemptions",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_voucher_redemptions_user_id"), table_name="voucher_redemptions"
    )
    op.drop_index(
        op.f("ix_voucher_redemptions_voucher_id"), table_name="voucher_redemptions"
    )
    op.drop_table("voucher_redemptions")
    op.drop_index(op.f("ix_vouchers_bound_user_id"), table_name="vouchers")
    op.drop_index(op.f("ix_vouchers_code"), table_name="vouchers")
    op.drop_table("vouchers")
