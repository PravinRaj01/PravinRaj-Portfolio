"""add experience slug

Revision ID: 9f1c3ab27e04
Revises: 72364a53ddbe
Create Date: 2026-09-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '9f1c3ab27e04'
down_revision: Union[str, Sequence[str], None] = '72364a53ddbe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('experiences', sa.Column('slug', sa.Text(), nullable=True))

    # Backfill existing rows from `title`, using the exact same regex as
    # projects' slug backfill (see app/api/routers/projects.py's _slugify),
    # deduping collisions with a numeric suffix the same way
    # experiences.py's _unique_slug does at runtime (first occurrence keeps
    # the base slug, later ones get -2, -3, ...).
    op.execute("""
        WITH base AS (
            SELECT id,
                   lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9\\s-]', '', 'g'), '\\s+', '-', 'g')) AS base_slug
            FROM experiences
        ),
        numbered AS (
            SELECT id, base_slug,
                   ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY id) AS rn
            FROM base
        )
        UPDATE experiences e
        SET slug = CASE WHEN numbered.rn = 1 THEN numbered.base_slug ELSE numbered.base_slug || '-' || numbered.rn END
        FROM numbered
        WHERE e.id = numbered.id
    """)

    op.create_unique_constraint('experiences_slug_unique', 'experiences', ['slug'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('experiences_slug_unique', 'experiences', type_='unique')
    op.drop_column('experiences', 'slug')
