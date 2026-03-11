"""add folders and folder assignments

Revision ID: 005
Revises: 004
Create Date: 2026-03-08

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SYSTEM_FOLDERS = (
    ("all_documents", "Все документы"),
    ("tool_document_analyzer", "Анализатор документов"),
    ("tool_contract_checker", "Проверка договоров"),
    ("tool_data_extractor", "Извлечение данных"),
    ("tool_tender_analyzer", "Tender Analyzer"),
    ("tool_risk_analyzer", "Risk Analyzer"),
)


def upgrade() -> None:
    op.create_table(
        "folders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=True),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("system_key", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_folders_user_id", "folders", ["user_id"], unique=False)
    op.create_index("ix_folders_system_key", "folders", ["system_key"], unique=False)
    op.create_index("ix_folders_user_type", "folders", ["user_id", "type"], unique=False)
    op.create_index("uq_folders_user_system_key", "folders", ["user_id", "system_key"], unique=True)

    with op.batch_alter_table("documents") as batch_op:
        batch_op.add_column(sa.Column("folder_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_documents_folder_id", ["folder_id"], unique=False)
        batch_op.create_index(
            "ix_documents_user_folder_created_at",
            ["user_id", "folder_id", "created_at"],
            unique=False,
        )

    with op.batch_alter_table("document_analyses") as batch_op:
        batch_op.add_column(sa.Column("folder_id", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column("status", sa.String(length=32), nullable=False, server_default="completed")
        )
        batch_op.create_index("ix_document_analyses_folder_id", ["folder_id"], unique=False)
        batch_op.create_index(
            "ix_document_analyses_user_folder_created_at",
            ["user_id", "folder_id", "created_at"],
            unique=False,
        )
        batch_op.create_index(
            "ix_document_analyses_user_tool_created_at",
            ["user_id", "tool_slug", "created_at"],
            unique=False,
        )

    connection = op.get_bind()
    user_ids = [row[0] for row in connection.execute(sa.text("SELECT id FROM users")).fetchall()]

    for user_id in user_ids:
        for system_key, name in SYSTEM_FOLDERS:
            connection.execute(
                sa.text(
                    """
                    INSERT INTO folders (user_id, name, slug, type, system_key, created_at, updated_at)
                    VALUES (:user_id, :name, :slug, 'system', :system_key, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                ),
                {
                    "user_id": user_id,
                    "name": name,
                    "slug": system_key,
                    "system_key": system_key,
                },
            )

        all_documents_id = connection.execute(
            sa.text(
                "SELECT id FROM folders WHERE user_id = :user_id AND system_key = 'all_documents'"
            ),
            {"user_id": user_id},
        ).scalar_one()
        connection.execute(
            sa.text(
                "UPDATE documents SET folder_id = :folder_id WHERE user_id = :user_id AND folder_id IS NULL"
            ),
            {"folder_id": all_documents_id, "user_id": user_id},
        )
        connection.execute(
            sa.text(
                "UPDATE document_analyses SET folder_id = :folder_id WHERE user_id = :user_id AND folder_id IS NULL"
            ),
            {"folder_id": all_documents_id, "user_id": user_id},
        )


def downgrade() -> None:
    with op.batch_alter_table("document_analyses") as batch_op:
        batch_op.drop_index("ix_document_analyses_user_tool_created_at")
        batch_op.drop_index("ix_document_analyses_user_folder_created_at")
        batch_op.drop_index("ix_document_analyses_folder_id")
        batch_op.drop_column("status")
        batch_op.drop_column("folder_id")

    with op.batch_alter_table("documents") as batch_op:
        batch_op.drop_index("ix_documents_user_folder_created_at")
        batch_op.drop_index("ix_documents_folder_id")
        batch_op.drop_column("folder_id")

    op.drop_index("uq_folders_user_system_key", table_name="folders")
    op.drop_index("ix_folders_user_type", table_name="folders")
    op.drop_index("ix_folders_system_key", table_name="folders")
    op.drop_index("ix_folders_user_id", table_name="folders")
    op.drop_table("folders")
