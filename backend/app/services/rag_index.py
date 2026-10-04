# app/services/rag_index.py -- RAG_MIGRATION_PLAN.md §8-9. Turns every
# retrievable DB row into one self-contained text chunk and keeps the
# portfolio_chunks table (embeddings + full-text) in sync with it.
#
# Contact details, socials, the resume URL and the page list are NOT chunked:
# they are the always-on core injected into every prompt
# (ai_content._build_core_context), so they can never depend on a search hit.
import logging
from dataclasses import dataclass

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import Certification, Education, Experience
from app.models.content import AboutContent, HeroContent, Service, Skill
from app.models.projects import Project
from app.models.rag import PortfolioChunk
from app.services.embeddings import content_hash, embed_documents, to_pgvector

logger = logging.getLogger(__name__)

# One chunk must stay well inside gemini-embedding-001's 2048-token input cap.
_MAX_CHUNK_CHARS = 1500


@dataclass(frozen=True)
class Chunk:
    source_key: str
    source_type: str
    mode: str  # professional | creative | both
    title: str
    content: str

    @property
    def digest(self) -> str:
        # mode and title are part of the digest, not just content: a project
        # that changes mode, or is renamed, must be re-written (the title is
        # weighted in full-text search) even though its body is identical.
        return content_hash(f"{self.mode}\x00{self.title}\x00{self.content}")


def _clip(text_: str, limit: int) -> str:
    text_ = " ".join(text_.split())
    return text_ if len(text_) <= limit else text_[: limit - 1].rstrip() + "…"


def _join(items: list[str] | None) -> str:
    return ", ".join(i for i in (items or []) if i)


def _finish(parts: list[str]) -> str:
    return _clip(" ".join(p for p in parts if p), _MAX_CHUNK_CHARS)


def _project_chunk(p: Project) -> Chunk | None:
    if not (p.description or "").strip():
        return None
    categories = _join(p.categories) or p.category
    positions = _join(p.positions) or (p.position or "")
    links = [
        f"{link.get('label')}: {link.get('url')}"
        for link in (p.project_links or [])
        if isinstance(link, dict) and link.get("url")
    ]
    content = _finish(
        [
            f"Project: {p.title}"
            + (f" ({categories})" if categories else "")
            + (" [Featured]" if p.featured else "")
            + ".",
            _clip(p.description, 1000),
            f"Role: {positions}." if positions else "",
            f"Date: {p.project_date}." if p.project_date else "",
            f"Technologies: {_join(p.tags)}." if p.tags else "",
            f"GitHub: {p.github_url}." if p.github_url else "",
            f"Live: {p.live_url}." if p.live_url else "",
            f"Links: {'; '.join(links)}." if links else "",
        ]
    )
    return Chunk(f"project:{p.id}", "project", p.mode, p.title, content)


def _experience_chunk(e: Experience) -> Chunk | None:
    if not (e.description or "").strip():
        return None
    kind = "Event" if (e.experience_type or "job") != "job" else "Work experience"
    content = _finish(
        [
            f"{kind}: {e.title} at {e.company}"
            + (f", {e.location}" if e.location else "")
            + (f" ({e.period})" if e.period else "")
            + ".",
            f"Role: {e.role}." if e.role else "",
            _clip(e.description, 1000),
            f"Achievements: {_join(e.achievements)}." if e.achievements else "",
        ]
    )
    return Chunk(f"experience:{e.id}", "experience", e.mode, f"{e.title} at {e.company}", content)


def _education_chunk(e: Education) -> Chunk | None:
    content = _finish(
        [
            f"Education: {e.degree} from {e.institution}"
            + (f", {e.location}" if e.location else "")
            + (f" ({e.period})" if e.period else "")
            + ".",
            _clip(e.description or "", 800),
            f"Achievements: {_join(e.achievements)}." if e.achievements else "",
        ]
    )
    return Chunk(f"education:{e.id}", "education", "both", f"{e.degree} — {e.institution}", content)


def _certification_chunk(c: Certification) -> Chunk | None:
    content = _finish(
        [
            f"Certification{' [Featured]' if c.featured else ''}: {c.name} issued by {c.issuer}"
            + (f" ({c.date})" if c.date else "")
            + ".",
            _clip(c.description or "", 800),
            f"Credential ID: {c.credential_id}." if c.credential_id else "",
            f"Credential URL: {c.credential_url}." if c.credential_url else "",
        ]
    )
    return Chunk(f"certification:{c.id}", "certification", "both", c.name, content)


def _service_chunk(s: Service) -> Chunk | None:
    if not (s.description or "").strip():
        return None
    content = _finish(
        [
            f"Service offered: {s.title}.",
            _clip(s.description, 900),
            f"Includes: {_join(s.features)}." if s.features else "",
        ]
    )
    return Chunk(f"service:{s.id}", "service", "both", s.title, content)


def _about_chunk(a: AboutContent) -> Chunk | None:
    if not (a.content or "").strip():
        return None
    heading = a.section_title or "About"
    content = _finish([f"About ({heading}):", _clip(a.content, 1300)])
    # section_title can be a bare quote attribution ("Steve Jobs"), which reads
    # as nonsense as a heading in the prompt -- so label it as the About section.
    return Chunk(f"about:{a.id}", "about", a.mode, f"About: {heading}", content)


def _skill_chunk(s: Skill) -> Chunk | None:
    if not s.skills:
        return None
    content = _finish([f"Skills, {s.category}: {_join(s.skills)}."])
    return Chunk(f"skill:{s.id}", "skills", s.mode, f"Skills: {s.category}", content)


def _hero_chunk(h: HeroContent) -> Chunk | None:
    # Name/title/description already live in the always-on core; the only
    # thing worth retrieving here is the fun facts.
    if not h.fun_facts:
        return None
    content = _finish([f"{h.name}, {h.title}. Fun facts: {_join(h.fun_facts)}."])
    return Chunk(f"hero:{h.id}", "hero", h.mode, f"About {h.name} (fun facts)", content)


async def build_chunks(db: AsyncSession) -> list[Chunk]:
    """Reads every content table and renders one self-contained chunk per row."""

    async def rows(model, *order):
        return list((await db.execute(select(model).order_by(*order))).scalars().all())

    projects = list(
        (
            await db.execute(
                select(Project)
                .where(Project.is_active.is_not(False))
                .order_by(Project.order_index)
            )
        )
        .scalars()
        .all()
    )

    builders = [
        (projects, _project_chunk),
        (await rows(Experience, Experience.order_index), _experience_chunk),
        (await rows(Education, Education.order_index), _education_chunk),
        (await rows(Certification, Certification.order_index), _certification_chunk),
        (await rows(Service, Service.order_index), _service_chunk),
        (await rows(AboutContent, AboutContent.order_index), _about_chunk),
        (await rows(Skill, Skill.order_index), _skill_chunk),
        (await rows(HeroContent, HeroContent.order_index), _hero_chunk),
    ]
    chunks: list[Chunk] = []
    for items, build in builders:
        for item in items:
            chunk = build(item)
            if chunk is not None:
                chunks.append(chunk)
    return chunks


async def reindex_best_effort() -> None:
    """Called after an admin content write. The write has already succeeded
    and been committed, so nothing here may turn it into an error: any failure
    (quota, network, DB) is logged and swallowed, and the next write or a
    manual /ai/reindex catches the index up."""
    from app.db.session import SessionLocal

    try:
        async with SessionLocal() as db:
            await reindex(db)
    except Exception:
        logger.exception("RAG auto-reindex after content write failed")


_UPSERT_SQL = text(
    """
    INSERT INTO portfolio_chunks
        (source_key, source_type, mode, title, content, content_hash,
         token_estimate, embedding, updated_at)
    VALUES
        (:source_key, :source_type, :mode, :title, :content, :content_hash,
         :token_estimate, CAST(CAST(:embedding AS text) AS vector), now())
    ON CONFLICT (source_key) DO UPDATE SET
        source_type = EXCLUDED.source_type,
        mode = EXCLUDED.mode,
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        content_hash = EXCLUDED.content_hash,
        token_estimate = EXCLUDED.token_estimate,
        embedding = EXCLUDED.embedding,
        updated_at = now()
    """
)


async def reindex(db: AsyncSession, *, force: bool = False) -> dict[str, int]:
    """Upserts all chunks, embedding only those whose text actually changed,
    and drops chunks whose source row is gone. Raises RagUnavailableError (via
    embed_documents) when embeddings can't be produced -- nothing is written
    in that case, because every embedding is computed before the first write.
    """
    chunks = await build_chunks(db)
    existing = {
        key: digest
        for key, digest in (
            await db.execute(select(PortfolioChunk.source_key, PortfolioChunk.content_hash))
        ).all()
    }

    stale = [c for c in chunks if force or existing.get(c.source_key) != c.digest]
    vectors = await embed_documents([c.content for c in stale]) if stale else []

    for chunk, vector in zip(stale, vectors, strict=True):
        await db.execute(
            _UPSERT_SQL,
            {
                "source_key": chunk.source_key,
                "source_type": chunk.source_type,
                "mode": chunk.mode,
                "title": chunk.title,
                "content": chunk.content,
                "content_hash": chunk.digest,
                "token_estimate": len(chunk.content) // 4,
                "embedding": to_pgvector(vector),
            },
        )

    deleted = await db.execute(
        text("DELETE FROM portfolio_chunks WHERE source_key <> ALL(CAST(:keys AS text[]))"),
        {"keys": [c.source_key for c in chunks]},
    )
    await db.commit()
    result = {"total": len(chunks), "embedded": len(stale), "deleted": deleted.rowcount or 0}
    logger.info("RAG reindex: %s", result)
    return result
