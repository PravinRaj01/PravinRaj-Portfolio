"""add hero card fields

Revision ID: 7ceea95944f7
Revises: 9f1c3ab27e04
Create Date: 2026-09-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7ceea95944f7'
down_revision: Union[str, Sequence[str], None] = '9f1c3ab27e04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Back the hanging ID card's back face (see HangingCard.tsx): birth_date
    # drives the age shown on the card front, fun_facts populate the back.
    # Both are nullable/defaulted so existing hero_content rows are unaffected.
    op.add_column('hero_content', sa.Column('birth_date', sa.Date(), nullable=True))
    op.add_column(
        'hero_content',
        sa.Column('fun_facts', sa.ARRAY(sa.Text()), server_default=sa.text("'{}'::text[]"), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('hero_content', 'fun_facts')
    op.drop_column('hero_content', 'birth_date')
