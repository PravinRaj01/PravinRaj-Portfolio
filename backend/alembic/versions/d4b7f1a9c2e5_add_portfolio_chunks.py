"""add portfolio_chunks (pgvector + full-text) for chatbot RAG

Revision ID: d4b7f1a9c2e5
Revises: c1a8e6f2b93d
Create Date: 2026-10-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4b7f1a9c2e5'
down_revision: Union[str, Sequence[str], None] = 'c1a8e6f2b93d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table('portfolio_chunks',
    sa.Column('source_key', sa.Text(), nullable=False),
    sa.Column('source_type', sa.String(length=32), nullable=False),
    sa.Column('mode', sa.String(length=20), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('content_hash', sa.String(length=64), nullable=False),
    sa.Column('token_estimate', sa.Integer(), server_default='0', nullable=False),
    sa.Column('embedding', Vector(768), nullable=True),
    sa.Column('search_tsv', postgresql.TSVECTOR(), sa.Computed("setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(content, '')), 'B')", persisted=True), nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('portfolio_chunks_pkey')),
    sa.UniqueConstraint('source_key', name=op.f('portfolio_chunks_source_key_key'))
    )
    op.create_index('portfolio_chunks_mode_idx', 'portfolio_chunks', ['mode'], unique=False)
    op.create_index('portfolio_chunks_search_idx', 'portfolio_chunks', ['search_tsv'], unique=False, postgresql_using='gin')
    op.create_index('portfolio_chunks_embedding_idx', 'portfolio_chunks', ['embedding'], unique=False, postgresql_using='hnsw', postgresql_ops={'embedding': 'vector_cosine_ops'})


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('portfolio_chunks_embedding_idx', table_name='portfolio_chunks', postgresql_using='hnsw', postgresql_ops={'embedding': 'vector_cosine_ops'})
    op.drop_index('portfolio_chunks_search_idx', table_name='portfolio_chunks', postgresql_using='gin')
    op.drop_index('portfolio_chunks_mode_idx', table_name='portfolio_chunks')
    op.drop_table('portfolio_chunks')
    # The vector extension is deliberately left installed.
