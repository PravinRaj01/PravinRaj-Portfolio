"""add ai_chat_requests

Revision ID: c1a8e6f2b93d
Revises: 7ceea95944f7
Create Date: 2026-09-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c1a8e6f2b93d'
down_revision: Union[str, Sequence[str], None] = '7ceea95944f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('ai_chat_requests',
    sa.Column('ip', sa.Text(), nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('ai_chat_requests_pkey'))
    )
    op.create_index('idx_ai_chat_requests_ip_created', 'ai_chat_requests', ['ip', 'created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_ai_chat_requests_ip_created', table_name='ai_chat_requests')
    op.drop_table('ai_chat_requests')
