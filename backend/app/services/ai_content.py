# app/services/ai_content.py — MIGRATION_PLAN.md §7 "stubs" row: ports the
# prompt-building and data-assembly logic of the three original Edge
# Functions (supabase/functions/{generate-description,generate-magazine,
# portfolio-chat}/index.ts) onto our own DB session and the shared
# ai_gateway client, replacing each function's direct Supabase service-role
# reads with our normal async ORM queries.
import asyncio
import base64
import json
import logging
import re
from collections.abc import AsyncIterator
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.academic import Certification, Education, Experience
from app.models.content import (
    AboutContent,
    ContactContent,
    HeroContent,
    Service,
    Skill,
    Social,
)
from app.models.projects import Project
from app.models.site import SiteSettings
from app.schemas.ai import (
    ChatContentMode,
    ChatRequest,
    DescriptionGenerateRequest,
    DescriptionGenerateResponse,
    MagazineGenerateRequest,
    MagazineGenerateResponse,
)
from app.services import ai_gateway, embeddings

logger = logging.getLogger(__name__)

# Model names themselves now live in app/core/config.py (one pair of
# settings per provider per model_kind) -- ai_gateway resolves them.


# --- generate-description --------------------------------------------------

def _build_description_prompt(request: DescriptionGenerateRequest) -> str:
    data = request.data
    context_parts: list[str] = []

    if data.title:
        context_parts.append(f'Title: "{data.title}"')
    if data.category:
        context_parts.append(f"Category: {data.category}")
    if data.categories:
        context_parts.append(f"Categories: {', '.join(data.categories)}")
    if data.tags:
        context_parts.append(f"Tags: {', '.join(data.tags)}")
    if data.positions:
        context_parts.append(f"Position(s)/Role(s): {', '.join(data.positions)}")
    if data.role:
        context_parts.append(f"Role: {data.role}")
    if data.company:
        context_parts.append(f"Company/Organization: {data.company}")
    if data.location:
        context_parts.append(f"Location: {data.location}")
    if data.date:
        context_parts.append(f"Date: {data.date}")
    if data.period:
        context_parts.append(f"Period: {data.period}")
    if data.achievements:
        context_parts.append(f"Key achievements/highlights: {'; '.join(data.achievements)}")
    if data.images:
        context_parts.append(f"{len(data.images)} image(s) uploaded")

    context_string = "\n- ".join(context_parts)

    if request.mode == "professional":
        style_guide = """
Style requirements for PROFESSIONAL mode:
- Write in a concise, formal, and technical tone
- Focus on impact, metrics, and outcomes where possible
- Use clear, direct language without excessive adjectives
- Keep it between 2-4 sentences
- Avoid markdown formatting, use plain text"""
    else:
        style_guide = """
Style requirements for CREATIVE mode:
- Write in an engaging, narrative style that tells a story
- Use vivid language and emotional connection
- Can use rich formatting with **bold** for emphasis and *italics* for quotes
- Keep it between 3-5 sentences, can be longer if the context is rich
- Feel free to use markdown formatting for emphasis"""

    if request.entityType == "project":
        entity_guide = """
This is a PORTFOLIO PROJECT description. Focus on:
- What the project is about
- The role/contribution of the portfolio owner
- Key technologies, methods, or approaches used
- Impact or outcomes if apparent from context"""
    else:
        entity_guide = """
This is a WORK EXPERIENCE / EVENT description. Focus on:
- What the role/event involved
- Key responsibilities or contributions
- Notable achievements or highlights
- The significance of this experience"""

    user_context = ""
    if request.additionalContext and request.additionalContext.strip():
        user_context = f'\n\nAdditional context from user:\n"{request.additionalContext.strip()}"'

    return f"""You are a professional portfolio writer. Generate a compelling description based on the following information.

{entity_guide}

{style_guide}

Available information:
- {context_string}{user_context}

Generate ONLY the description text. Do not include any preamble, labels, or explanations. Just the description itself."""


_MAX_IMAGE_BYTES = 4 * 1024 * 1024  # skip anything unexpectedly huge rather than fail the request


async def _image_to_data_uri(url: str) -> str | None:
    """Gemini's OpenAI-compatible endpoint only accepts base64 data: URIs, not
    remote URLs, so admin's Drive thumbnail links have to be downloaded and
    re-encoded here. Any failure (timeout, 404, oversized) just drops that
    one image rather than failing the whole generation."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
        if not response.is_success or len(response.content) > _MAX_IMAGE_BYTES:
            return None
        content_type = response.headers.get("content-type", "image/jpeg").split(";")[0]
        encoded = base64.b64encode(response.content).decode("ascii")
        return f"data:{content_type};base64,{encoded}"
    except httpx.HTTPError:
        return None


async def generate_description(request: DescriptionGenerateRequest) -> DescriptionGenerateResponse:
    if not request.data.title or not request.data.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please fill in at least a title before generating",
        )

    prompt = _build_description_prompt(request)
    system_message = {
        "role": "system",
        "content": "You are a professional portfolio writer. Generate compelling, accurate descriptions based on the provided context.",
    }

    # Text-only variant -- always available, and what the fallback provider
    # gets (Groq's only vision model is a preview one, not relied on here).
    fallback_messages = [system_message, {"role": "user", "content": prompt}]

    messages = fallback_messages
    if request.data.images:
        data_uris = [
            uri
            for uri in await _gather_images(request.data.images[:3])
            if uri is not None
        ]
        if data_uris:
            content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
            content.extend({"type": "image_url", "image_url": {"url": uri}} for uri in data_uris)
            messages = [system_message, {"role": "user", "content": content}]

    result = await ai_gateway.chat_completion(
        messages,
        model_kind="content",
        max_tokens=500,
        fallback_messages=fallback_messages,
    )
    choices = result.get("choices") or []
    description = ((choices[0].get("message") or {}).get("content") or "").strip() if choices else ""

    if not description:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="No description generated"
        )
    return DescriptionGenerateResponse(description=description, success=True)


async def _gather_images(urls: list[str]) -> list[str | None]:
    return list(await asyncio.gather(*(_image_to_data_uri(u) for u in urls)))


# --- generate-magazine -------------------------------------------------

_MAGAZINE_TOOL = {
    "type": "function",
    "function": {
        "name": "generate_magazine_issue",
        "description": "Generate a structured magazine issue with cover, editor's note, articles, and closing page.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Issue title, e.g. 'The AI Architect — Feb 2026'"},
                "cover": {
                    "type": "object",
                    "properties": {
                        "headline": {"type": "string", "description": "Bold cover headline"},
                        "subhead": {"type": "string", "description": "Cover subtitle"},
                    },
                    "required": ["headline", "subhead"],
                },
                "editors_note": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Editor's note title"},
                        "body": {"type": "string", "description": "Editor's note body (2-3 paragraphs)"},
                    },
                    "required": ["title", "body"],
                },
                "articles": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "project_id": {"type": "string", "description": "UUID of the project"},
                            "headline": {"type": "string", "description": "Article headline"},
                            "pull_quote": {"type": "string", "description": "A memorable quote from the article"},
                            "body": {"type": "string", "description": "Article body (2-3 paragraphs, 150-250 words)"},
                            "layout": {
                                "type": "string",
                                "enum": ["split_left", "split_right", "full_bleed"],
                                "description": "Page layout style",
                            },
                        },
                        "required": ["project_id", "headline", "pull_quote", "body", "layout"],
                    },
                },
                "closing": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Closing page title"},
                        "body": {"type": "string", "description": "Closing call-to-action text"},
                    },
                    "required": ["title", "body"],
                },
            },
            "required": ["title", "cover", "editors_note", "articles", "closing"],
            "additionalProperties": False,
        },
    },
}


async def generate_magazine(
    db: AsyncSession, request: MagazineGenerateRequest
) -> MagazineGenerateResponse:
    stmt = (
        select(Project)
        .where(Project.mode == "creative", Project.is_active.is_(True))
        .order_by(Project.order_index.asc())
    )
    if request.project_ids:
        stmt = stmt.where(Project.id.in_(request.project_ids))
    else:
        stmt = stmt.where(Project.featured.is_(True))

    projects = list((await db.execute(stmt)).scalars().all())
    if not projects:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No projects found to generate magazine from",
        )

    project_summaries = "\n\n".join(
        f'Project {i + 1}: "{p.title}" — {p.description}. '
        f"Tags: {', '.join(p.tags or [])}. Category: {p.category}. "
        f"Role: {p.position or ', '.join(p.positions or []) or 'Developer'}."
        for i, p in enumerate(projects)
    )

    theme_instruction = (
        f'\nEditorial direction from the portfolio owner: "{request.theme_hint}"\n'
        if request.theme_hint
        else ""
    )

    system_prompt = f"""You are the Editor-in-Chief of "Code & Creative", a high-end tech magazine showcasing the work of a talented developer named Pravin Raj.

Your task: Take these project descriptions and craft a compelling magazine issue. Write in sophisticated, narrative journalistic style — NOT resume-speak. No "utilized", no "leveraged". Instead, tell stories. Be slightly witty, insightful, and engaging.

Rules:
- Cover headline should be bold and attention-grabbing
- Editor's note should be warm and set the tone for the issue
- Each article should read like a feature story, not a project description
- Pull quotes should be memorable one-liners
- The closing page should be an invitation to connect
- Use varied layouts for visual interest: "split_left", "split_right", "full_bleed"
- Keep article bodies to 2-3 paragraphs (150-250 words each)
{theme_instruction}
Here are the projects to feature:

{project_summaries}"""

    result = await ai_gateway.chat_completion(
        [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": "Generate the magazine issue now. Use the generate_magazine_issue tool to return the structured content.",
            },
        ],
        model_kind="content",
        tools=[_MAGAZINE_TOOL],
        tool_choice={"type": "function", "function": {"name": "generate_magazine_issue"}},
    )

    choices = result.get("choices") or []
    tool_calls = ((choices[0].get("message") or {}).get("tool_calls") or []) if choices else []
    tool_call = tool_calls[0] if tool_calls else None
    if not tool_call or tool_call.get("function", {}).get("name") != "generate_magazine_issue":
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI did not return expected tool call")

    magazine_content = json.loads(tool_call["function"]["arguments"])

    project_map = {str(p.id): p for p in projects}
    all_images = [p.image_home_drive_id or p.image_drive_id for p in projects if (p.image_home_drive_id or p.image_drive_id)]

    for idx, article in enumerate(magazine_content.get("articles", [])):
        proj = project_map.get(article.get("project_id"))
        if proj:
            article["image_drive_id"] = proj.image_home_drive_id or proj.image_drive_id
        if not article.get("image_drive_id") and all_images:
            article["image_drive_id"] = all_images[idx % len(all_images)]

    if all_images:
        magazine_content["cover"]["cover_image_drive_id"] = all_images[0]

    return MagazineGenerateResponse(
        title=magazine_content["title"],
        cover_headline=magazine_content["cover"]["headline"],
        cover_subhead=magazine_content["cover"]["subhead"],
        content=magazine_content,
        project_ids=[str(p.id) for p in projects],
    )


# --- portfolio-chat ----------------------------------------------------

_DANGEROUS_PATTERNS = [
    re.compile(r"system:", re.IGNORECASE),
    re.compile(r"assistant:", re.IGNORECASE),
    re.compile(r"<\|im_start\|>", re.IGNORECASE),
    re.compile(r"<\|im_end\|>", re.IGNORECASE),
    re.compile(r"\[INST\]", re.IGNORECASE),
    re.compile(r"\[/INST\]", re.IGNORECASE),
]


def _sanitize_input(text_: str | None, max_length: int = 2000) -> str:
    if not text_ or not isinstance(text_, str):
        return ""
    sanitized = text_[:max_length].strip()
    for pattern in _DANGEROUS_PATTERNS:
        sanitized = pattern.sub("", sanitized)
    return sanitized


_COMPACT_DESCRIPTION_CHARS = 200


def _shorten(text_: str, limit: int) -> str:
    return text_ if len(text_) <= limit else text_[:limit].rstrip() + "…"


def _resolve_resume_url(site_settings: SiteSettings | None, content_mode: ChatContentMode) -> str | None:
    # The legacy site_settings.resume_url the original Edge Function read is
    # a dead Supabase URL post-migration (MIGRATION_PLAN.md §13) -- point at
    # the real, mode-specific R2 URL instead so the chatbot's resume button
    # doesn't hand out a broken link.
    if not site_settings:
        return None
    if content_mode == "creative":
        return site_settings.creative_resume_url or site_settings.professional_resume_url
    return site_settings.professional_resume_url or site_settings.creative_resume_url


def _mode_label(content_mode: ChatContentMode) -> str:
    return (
        "all content (professional and creative)"
        if content_mode == "both"
        else f"{content_mode} content only"
    )


_WEBSITE_PAGES = """## Website Pages
- **Home** (/): Main landing page with hero section, about, skills, and featured projects
- **Projects** (/projects): Full portfolio of all projects with filtering options
- **Experience** (/experience): Work history and professional experience details
- **Academic** (/academic): Education background and certifications
- **Podcast** (/podcast): Podcast content and episodes
- **Contact** (/contact): Contact form and information
- **Playground** (/playground): Hidden fun page with interactive games! Users can access it by entering the Konami Code (↑↑↓↓←→←→BA) anywhere on the site, or by directly visiting /playground. Features retro arcade-style games like Neon Breakout."""


async def _build_portfolio_context(
    db: AsyncSession, content_mode: ChatContentMode, *, compact: bool = False
) -> tuple[str, HeroContent | None, str | None]:
    """`compact=True` trims each project/experience description to a couple
    of sentences. Used only for the Groq fallback: Groq's free tier caps at
    8K tokens/minute, and the full context alone can be 6-9K tokens (creative
    mode has 27 projects) -- nearly a whole minute's budget for one message."""
    def mode_filter(stmt, column):
        if content_mode == "both":
            return stmt
        return stmt.where(column == content_mode)

    hero = (
        await db.execute(mode_filter(select(HeroContent), HeroContent.mode).limit(1))
    ).scalar_one_or_none()
    about = list(
        (await db.execute(mode_filter(select(AboutContent), AboutContent.mode).order_by(AboutContent.order_index)))
        .scalars()
        .all()
    )
    skills = list(
        (await db.execute(mode_filter(select(Skill), Skill.mode).order_by(Skill.order_index)))
        .scalars()
        .all()
    )
    projects = list(
        (await db.execute(mode_filter(select(Project), Project.mode).order_by(Project.order_index)))
        .scalars()
        .all()
    )
    experiences = list(
        (
            await db.execute(
                mode_filter(select(Experience), Experience.mode).order_by(Experience.order_index)
            )
        )
        .scalars()
        .all()
    )
    education = list((await db.execute(select(Education).order_by(Education.order_index))).scalars().all())
    services = list((await db.execute(select(Service).order_by(Service.order_index))).scalars().all())
    contact = (
        await db.execute(mode_filter(select(ContactContent), ContactContent.mode).limit(1))
    ).scalar_one_or_none()
    # Socials has no mode filter here, matching the original Edge Function's
    # query exactly -- see supabase/functions/portfolio-chat/index.ts.
    socials = list(
        (await db.execute(select(Social).where(Social.enabled.is_(True)).order_by(Social.order_index)))
        .scalars()
        .all()
    )
    certifications = list(
        (await db.execute(select(Certification).order_by(Certification.order_index))).scalars().all()
    )
    site_settings = (await db.execute(select(SiteSettings).limit(1))).scalar_one_or_none()

    mode_label = _mode_label(content_mode)
    resume_url = _resolve_resume_url(site_settings, content_mode)

    def maybe_shorten(text_: str) -> str:
        return _shorten(text_, _COMPACT_DESCRIPTION_CHARS) if compact else text_

    about_text = "\n".join(a.content for a in about)
    skills_text = "\n".join(f"**{s.category}**: {', '.join(s.skills or [])}" for s in skills)
    projects_text = "\n".join(
        f"- **{p.title}**{' [FEATURED]' if p.featured else ''} ({p.category}): {maybe_shorten(p.description)}"
        + (f" | Technologies: {', '.join(p.tags)}" if p.tags else "")
        + (f" | GitHub: {p.github_url}" if p.github_url else "")
        + (f" | Live: {p.live_url}" if p.live_url else "")
        for p in projects
    )
    experiences_text = "\n".join(
        f"- **{e.title}** at {e.company} ({e.period}): {maybe_shorten(e.description)}" for e in experiences
    )
    education_text = "\n".join(
        f"- **{e.degree}** from {e.institution} ({e.period})" for e in education
    )
    certifications_text = "\n".join(
        f"- **{c.name}**{' [FEATURED]' if c.featured else ''} by {c.issuer} ({c.date})"
        + (f" | Credential ID: {c.credential_id}" if c.credential_id else "")
        + (f" | Credential URL: {c.credential_url}" if c.credential_url else "")
        for c in certifications
    )
    services_text = "\n".join(f"- **{s.title}**: {s.description}" for s in services)
    socials_text = "\n".join(f"- **{s.name}**: {s.url}" for s in socials)

    return f"""
## Content Mode
You are currently answering based on: {mode_label}

## Portfolio Owner Information
Name: {hero.name if hero else "Portfolio Owner"}
Title: {hero.title if hero else "Professional"}
Greeting: {hero.greeting if hero else ""}
Description: {hero.description if hero else ""}

## Resume
{f"Resume URL: {resume_url}" if resume_url else "Resume not available"}

## About
{about_text}

## Skills & Technologies
{skills_text}

## Projects
{projects_text}

## Work Experience
{experiences_text}

## Education
{education_text}

## Certifications & Achievements
{certifications_text}

## Services Offered
{services_text}

## Social Media & Online Presence
{socials_text}

{_WEBSITE_PAGES}

## Contact
Email: {contact.email if contact else "Not provided"}
{f"Phone: {contact.phone}" if contact and contact.phone else ""}
{f"Location: {contact.location}" if contact and contact.location else ""}
""", hero, resume_url


# --- RAG (RAG_MIGRATION_PLAN.md §5, §10) ---------------------------------

async def _build_core_context(
    db: AsyncSession, content_mode: ChatContentMode
) -> tuple[str, HeroContent | None, str | None]:
    """The always-on block injected into every RAG prompt: owner identity,
    resume link, contact and socials, page list. These are what visitors ask
    for most and what the [button:...] links depend on, so they never ride on
    a search hit. Everything else (projects, experience, skills...) is
    retrieved per question."""
    def mode_filter(stmt, column):
        if content_mode == "both":
            return stmt
        return stmt.where(column == content_mode)

    hero = (
        await db.execute(mode_filter(select(HeroContent), HeroContent.mode).limit(1))
    ).scalar_one_or_none()
    contact = (
        await db.execute(mode_filter(select(ContactContent), ContactContent.mode).limit(1))
    ).scalar_one_or_none()
    socials = list(
        (await db.execute(select(Social).where(Social.enabled.is_(True)).order_by(Social.order_index)))
        .scalars()
        .all()
    )
    site_settings = (await db.execute(select(SiteSettings).limit(1))).scalar_one_or_none()

    resume_url = _resolve_resume_url(site_settings, content_mode)
    socials_text = "\n".join(f"- **{s.name}**: {s.url}" for s in socials)

    return f"""
## Content Mode
You are currently answering based on: {_mode_label(content_mode)}

## Portfolio Owner Information
Name: {hero.name if hero else "Portfolio Owner"}
Title: {hero.title if hero else "Professional"}
Greeting: {hero.greeting if hero else ""}
Description: {hero.description if hero else ""}

## Resume
{f"Resume URL: {resume_url}" if resume_url else "Resume not available"}

## Social Media & Online Presence
{socials_text}

{_WEBSITE_PAGES}

## Contact
Email: {contact.email if contact else "Not provided"}
{f"Phone: {contact.phone}" if contact and contact.phone else ""}
{f"Location: {contact.location}" if contact and contact.location else ""}
""", hero, resume_url


# Hybrid search: a vector branch (by meaning) and a full-text branch (by exact
# words), merged with Reciprocal Rank Fusion -- score = 1/(60+rank) summed over
# the branches a chunk appears in. Vectors are bound as *text* and cast in SQL
# so no asyncpg codec has to be registered on each new NullPool connection.
_SEARCH_SQL = text(
    """
    WITH vec AS (
        SELECT id,
               row_number() OVER (
                   ORDER BY embedding <=> CAST(CAST(:query_vec AS text) AS vector)
               ) AS rnk
        FROM portfolio_chunks
        WHERE embedding IS NOT NULL
          AND (CAST(:mode AS text) = 'both' OR mode = CAST(:mode AS text) OR mode = 'both')
          AND 1 - (embedding <=> CAST(CAST(:query_vec AS text) AS vector)) >= :min_cos
        ORDER BY rnk
        LIMIT :pool
    ),
    q AS (
        -- plainto_tsquery ANDs every word; swapping & for | lets any matching
        -- word count and ts_rank_cd sort out relevance. Its lexemes are already
        -- stripped of punctuation, so the replace can't corrupt them.
        SELECT replace(plainto_tsquery('english', CAST(:query_text AS text))::text, '&', '|')::tsquery AS tsq
    ),
    fts AS (
        SELECT c.id,
               row_number() OVER (ORDER BY ts_rank_cd(c.search_tsv, q.tsq) DESC) AS rnk
        FROM portfolio_chunks c, q
        WHERE c.search_tsv @@ q.tsq
          AND (CAST(:mode AS text) = 'both' OR c.mode = CAST(:mode AS text) OR c.mode = 'both')
        ORDER BY rnk
        LIMIT :pool
    )
    SELECT c.title, c.content, c.source_type,
           COALESCE(1.0 / (60 + vec.rnk), 0) + COALESCE(1.0 / (60 + fts.rnk), 0) AS score,
           vec.rnk AS vec_rank, fts.rnk AS fts_rank
    FROM portfolio_chunks c
    LEFT JOIN vec ON vec.id = c.id
    LEFT JOIN fts ON fts.id = c.id
    WHERE vec.id IS NOT NULL OR fts.id IS NOT NULL
    ORDER BY score DESC
    LIMIT :k
    """
)


def _retrieval_query(message: str, history: list[dict[str, str]]) -> str:
    """'Tell me more about it' carries nothing searchable on its own, so a short
    follow-up borrows the previous user turn."""
    if len(message) >= 40:
        return message
    previous = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")
    return f"{previous}\n{message}".strip() if previous else message


async def _retrieve(db: AsyncSession, query: str, content_mode: ChatContentMode) -> list[Any]:
    """Raises RagUnavailableError when retrieval can't run (embedding failure,
    empty index); the caller then falls back to the full portfolio context."""
    vector = await embeddings.embed_query(query)
    params = {
        "query_vec": embeddings.to_pgvector(vector),
        "query_text": query,
        "mode": content_mode,
        "min_cos": settings.rag_min_score,
        "pool": settings.rag_pool,
        "k": settings.rag_top_k,
    }
    # A savepoint, so a failing search (index not migrated, extension missing)
    # leaves the surrounding transaction usable for the full-context fallback.
    async with db.begin_nested():
        rows = list((await db.execute(_SEARCH_SQL, params)).all())
        if not rows:
            has_index = (
                await db.execute(text("SELECT EXISTS (SELECT 1 FROM portfolio_chunks)"))
            ).scalar_one()
            if not has_index:
                raise embeddings.RagUnavailableError("portfolio_chunks is empty; run /ai/reindex")
    return rows


def _format_hits(rows: list[Any]) -> str:
    header = (
        "## Relevant portfolio information\n"
        "These entries were retrieved for the visitor's latest question. They may not "
        "cover everything about the portfolio owner: if the answer is not here or in the "
        "profile above, say you don't have that detail instead of guessing, and point to "
        "the relevant page or the contact details."
    )
    if not rows:
        return f"{header}\n\n(No specific entries matched this question.)\n"
    body = "\n\n".join(f"### {r.title}\n{r.content}" for r in rows)
    return f"{header}\n\n{body}\n"


async def _try_rag_context(
    db: AsyncSession, content_mode: ChatContentMode, query: str
) -> tuple[str, HeroContent | None, str | None] | None:
    """Core + retrieved chunks, or None to signal 'use the full context'."""
    try:
        core, hero, resume_url = await _build_core_context(db, content_mode)
        rows = await _retrieve(db, query, content_mode)
    except embeddings.RagUnavailableError as exc:
        logger.warning("RAG unavailable, using full portfolio context: %s", exc)
        return None
    except SQLAlchemyError:
        logger.exception("RAG retrieval query failed, using full portfolio context")
        await db.rollback()
        return None
    logger.info(
        "RAG retrieved %d chunks (vector=%d, fulltext=%d)",
        len(rows),
        sum(1 for r in rows if r.vec_rank is not None),
        sum(1 for r in rows if r.fts_rank is not None),
    )
    return core + _format_hits(rows), hero, resume_url


def _chat_system_prompt(
    owner_name: str, portfolio_context: str, resume_url: str | None, *, retrieved: bool = False
) -> str:
    intro = (
        "Here is the portfolio information you have access to for this conversation (the owner's profile "
        "details, plus the entries retrieved for the visitor's latest question):"
        if retrieved
        else "Here is the complete portfolio information you have access to:"
    )
    return f"""You are a friendly and professional AI assistant for {owner_name}'s portfolio website. Your role is to help visitors learn about the portfolio owner, their skills, projects, experience, and services.

{intro}
{portfolio_context}

Guidelines:
- Be conversational, helpful, and professional
- Answer questions about the portfolio owner's background, skills, projects, and experience
- If asked about contacting, provide the contact information available
- Keep responses concise but informative (under 200 words unless more detail is needed)
- If asked something not related to the portfolio, politely redirect to portfolio topics
- Be enthusiastic about the portfolio owner's work and achievements
- If you don't have specific information, say so honestly rather than making things up

IMPORTANT - Rich Response Formatting:
When providing links or downloadable resources, use this special button syntax to create clickable buttons:
- For the resume: [button:Download Resume](URL_HERE)
- For credential verification: [button:View Credential](URL_HERE)
- For project links: [button:View Project](URL_HERE) or [button:GitHub Repo](URL_HERE)
- For social profiles: [button:LinkedIn](URL_HERE), [button:GitHub](URL_HERE), etc.
- For email: [button:Send Email](mailto:EMAIL_HERE)

Example: If someone asks for the resume, respond with something like:
"Here's {owner_name}'s resume! [button:Download Resume]({resume_url or '#'})"

Always provide the button when you have the relevant URL available. This makes it easy for visitors to access resources directly."""


async def open_chat_stream(db: AsyncSession, request: ChatRequest) -> AsyncIterator[bytes]:
    """Builds the prompt and opens a verified upstream stream (see
    ai_gateway.open_stream for why the connect + status check happen here,
    awaited directly, rather than inside the generator FastAPI iterates)."""
    sanitized_message = _sanitize_input(request.message, 2000)
    if not sanitized_message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid message")

    sanitized_history = [
        {"role": m.role, "content": _sanitize_input(m.content, 2000)}
        for m in (request.conversationHistory or [])
    ][-10:]

    # RAG first (core profile + retrieved chunks, ~1.5K tokens, small enough
    # that Groq can take the very same prompt). None means retrieval is off or
    # couldn't run, and the whole portfolio goes in the prompt as before.
    rag_context = None
    if settings.rag_enabled:
        rag_context = await _try_rag_context(
            db, request.contentMode, _retrieval_query(sanitized_message, sanitized_history)
        )

    if rag_context is not None:
        portfolio_context, hero, resume_url = rag_context
        owner_name = hero.name if hero else "this portfolio"
        system_prompt = _chat_system_prompt(owner_name, portfolio_context, resume_url, retrieved=True)
        messages = [{"role": "system", "content": system_prompt}, *sanitized_history, {"role": "user", "content": sanitized_message}]
        logger.info("chat prompt: path=rag mode=%s ~%d tokens", request.contentMode, len(system_prompt) // 4)
        return await ai_gateway.open_stream(messages, model_kind="chat")

    portfolio_context, hero, resume_url = await _build_portfolio_context(db, request.contentMode)
    owner_name = hero.name if hero else "this portfolio"
    system_prompt = _chat_system_prompt(owner_name, portfolio_context, resume_url)
    messages = [{"role": "system", "content": system_prompt}, *sanitized_history, {"role": "user", "content": sanitized_message}]
    logger.info("chat prompt: path=full mode=%s ~%d tokens", request.contentMode, len(system_prompt) // 4)

    # Only worth building a second, trimmed prompt if a fallback provider is
    # actually configured to receive it.
    fallback_messages = None
    if settings.groq_api_key:
        compact_context, _, _ = await _build_portfolio_context(db, request.contentMode, compact=True)
        compact_prompt = _chat_system_prompt(owner_name, compact_context, resume_url)
        fallback_messages = [{"role": "system", "content": compact_prompt}, *sanitized_history, {"role": "user", "content": sanitized_message}]

    return await ai_gateway.open_stream(messages, model_kind="chat", fallback_messages=fallback_messages)
