"""App configuration, loaded from environment variables / .env (see .env.example).

See MIGRATION_PLAN.md §2-3, §8. `database_url` is Neon's pooled (-pooler, PgBouncer
transaction-mode) endpoint for normal app traffic; `database_url_direct` is the
non-pooler endpoint, used only by Alembic (prepared statements don't survive
transaction-mode pooling).

Both URLs are normalized so a connection string copy-pasted straight from the
Neon dashboard (`postgresql://...?sslmode=require&channel_binding=require`)
works: asyncpg speaks neither `postgresql://` nor libpq-style `sslmode`/
`channel_binding` query params — SSL is instead passed via connect_args in
app/db/session.py and alembic/env.py.
"""

from functools import lru_cache
from urllib.parse import urlsplit, urlunsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DROP_QUERY_PARAMS = {"sslmode", "channel_binding"}


def _normalize_asyncpg_url(url: str) -> str:
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    elif url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://") :]

    parts = urlsplit(url)
    if parts.query:
        kept = [
            kv
            for kv in parts.query.split("&")
            if kv and kv.split("=", 1)[0] not in _DROP_QUERY_PARAMS
        ]
        parts = parts._replace(query="&".join(kept))
    return urlunsplit(parts)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    database_url_direct: str

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_public_base: str = ""

    cors_origins: str = ""
    # Optional regex for origins that can't be listed literally -- Vercel
    # gives every preview deployment its own hostname.
    cors_origin_regex: str = ""

    # "production" hides /docs, /redoc and /openapi.json (see main.py).
    environment: str = "development"

    # AI: Gemini (primary) + Groq (fallback), both free-tier only -- replaces
    # the old Lovable AI gateway. generate-description/generate-magazine use
    # the "content" models; the public chatbot uses the "chat" models. Model
    # names are env vars, not constants, so a renamed or retired free model
    # can be swapped in Vercel's settings without a code change. Either key
    # may be left empty (that provider is then skipped); both empty makes
    # the AI routes return 503, same as before.
    gemini_api_key: str = ""
    groq_api_key: str = ""
    gemini_chat_model: str = "gemini-3.5-flash-lite"
    gemini_content_model: str = "gemini-3.8-flash"
    groq_chat_model: str = "openai/gpt-oss-20b"
    groq_content_model: str = "openai/gpt-oss-120b"

    # RAG for the public chatbot (RAG_MIGRATION_PLAN.md). Off by default: with
    # rag_enabled false the chatbot behaves exactly as before (whole portfolio
    # in the prompt), and it also falls back to that per request whenever
    # retrieval can't run. Groq has no embeddings API, so embeddings are
    # Gemini-only.
    gemini_embedding_model: str = "gemini-embedding-001"
    rag_enabled: bool = False
    rag_top_k: int = 8  # chunks sent to the model after fusion
    rag_pool: int = 20  # candidates each search branch contributes to the fusion
    # COSINE floor for the vector branch only. Fused RRF scores are rank-based
    # (max ~0.033), so this can't be applied to the fused result. Calibrated on
    # a 39-question eval: gemini-embedding-001 has a high baseline (off-topic
    # text still scores ~0.5), and the lowest true positive was 0.606, so 0.55
    # sits just under it. It trims weak tail chunks but does NOT reliably gate
    # off-topic questions ("hello" scores ~0.6) -- that's harmless, the model
    # just ignores unrelated chunks.
    rag_min_score: float = 0.55

    # Public, read-only Drive API key for the resume/gallery folder proxy.
    google_drive_api_key: str = ""

    # Vercel Deploy Hook URL for the FRONTEND project (Project Settings → Git
    # → Deploy Hooks there, not this backend project) — POSTed to after an
    # admin content write so the prerendered static output stays fresh
    # (SEO_GEO_PLAN.md Phase 2). Empty by default: the rebuild trigger is a
    # no-op until this is set.
    vercel_deploy_hook_url: str = ""

    @field_validator("database_url", "database_url_direct")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        return _normalize_asyncpg_url(v)

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def r2_endpoint_url(self) -> str:
        return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
