"""add projects.github_synced_at / github_pushed_at

Revision ID: b8d2f4a6c0e1
Revises: a3e5c7d9b1f2
Create Date: 2026-10-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b8d2f4a6c0e1'
down_revision: Union[str, Sequence[str], None] = 'a3e5c7d9b1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('projects', sa.Column('github_synced_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('projects', sa.Column('github_pushed_at', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('projects', 'github_pushed_at')
    op.drop_column('projects', 'github_synced_at')
