"""add projects.date_display (month | full)

Revision ID: a3e5c7d9b1f2
Revises: d4b7f1a9c2e5
Create Date: 2026-10-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a3e5c7d9b1f2'
down_revision: Union[str, Sequence[str], None] = 'd4b7f1a9c2e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('projects', sa.Column('date_display', sa.Text(), server_default=sa.text("'month'"), nullable=False))
    # Projects already saved with a full date keep showing it; everything else stays month-only.
    op.execute(
        "UPDATE projects SET date_display = 'full' "
        "WHERE project_date ~ '^[0-9]{1,2} [A-Za-z]+ [0-9]{4}$'"
    )
    op.create_check_constraint('ck_projects_date_display', 'projects', "date_display IN ('month', 'full')")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_projects_date_display', 'projects', type_='check')
    op.drop_column('projects', 'date_display')
