# app/services/ai_content.py — MIGRATION_PLAN.md §7 "stubs" row: ports the
# prompt-building and data-assembly logic of the three original Edge
# Functions (supabase/functions/{generate-description,generate-magazine,
# portfolio-chat}/index.ts) onto our own DB session and the shared
# ai_gateway client, replacing each function's direct Supabase service-role
# reads with our normal async ORM queries.
import json
import re
from collections.abc import AsyncIterator
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.services import ai_gateway

DESCRIPTION_MODEL = "google/gemini-3-flash-preview"
MAGAZINE_MODEL = "google/gemini-3-flash-preview"
CHAT_MODEL = "google/gemini-2.5-flash"


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


async def generate_description(request: DescriptionGenerateRequest) -> DescriptionGenerateResponse:
    if not request.data.title or not request.data.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please fill in at least a title before generating",
        )

    prompt = _build_description_prompt(request)
    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": "You are a professional portfolio writer. Generate compelling, accurate descriptions based on the provided context.",
        }
    ]

    if request.data.images:
        content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        for image_url in request.data.images[:3]:
            content.append({"type": "image_url", "image_url": {"url": image_url}})
        messages.append({"role": "user", "content": content})
    else:
        messages.append({"role": "user", "content": prompt})

    result = await ai_gateway.chat_completion(messages, model=DESCRIPTION_MODEL, max_tokens=500)
    choices = result.get("choices") or []
    description = ((choices[0].get("message") or {}).get("content") or "").strip() if choices else ""

    if not description:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="No description generated"
        )
    return DescriptionGenerateResponse(description=description, success=True)


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
        model=MAGAZINE_MODEL,
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


async def _build_portfolio_context(
    db: AsyncSession, content_mode: ChatContentMode
) -> tuple[str, HeroContent | None, str | None]:
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

    mode_label = (
        "all content (professional and creative)"
        if content_mode == "both"
        else f"{content_mode} content only"
    )

    # The legacy site_settings.resume_url the original Edge Function read is
    # a dead Supabase URL post-migration (MIGRATION_PLAN.md §13) -- point at
    # the real, mode-specific R2 URL instead so the chatbot's resume button
    # doesn't hand out a broken link.
    resume_url = None
    if site_settings:
        if content_mode == "creative":
            resume_url = site_settings.creative_resume_url or site_settings.professional_resume_url
        else:
            resume_url = site_settings.professional_resume_url or site_settings.creative_resume_url

    about_text = "\n".join(a.content for a in about)
    skills_text = "\n".join(f"**{s.category}**: {', '.join(s.skills or [])}" for s in skills)
    projects_text = "\n".join(
        f"- **{p.title}**{' [FEATURED]' if p.featured else ''} ({p.category}): {p.description}"
        + (f" | Technologies: {', '.join(p.tags)}" if p.tags else "")
        + (f" | GitHub: {p.github_url}" if p.github_url else "")
        + (f" | Live: {p.live_url}" if p.live_url else "")
        for p in projects
    )
    experiences_text = "\n".join(
        f"- **{e.title}** at {e.company} ({e.period}): {e.description}" for e in experiences
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

## Website Pages
- **Home** (/): Main landing page with hero section, about, skills, and featured projects
- **Projects** (/projects): Full portfolio of all projects with filtering options
- **Experience** (/experience): Work history and professional experience details
- **Academic** (/academic): Education background and certifications
- **Podcast** (/podcast): Podcast content and episodes
- **Contact** (/contact): Contact form and information
- **Playground** (/playground): Hidden fun page with interactive games! Users can access it by entering the Konami Code (↑↑↓↓←→←→BA) anywhere on the site, or by directly visiting /playground. Features retro arcade-style games like Neon Breakout.

## Contact
Email: {contact.email if contact else "Not provided"}
{f"Phone: {contact.phone}" if contact and contact.phone else ""}
{f"Location: {contact.location}" if contact and contact.location else ""}
""", hero, resume_url


async def stream_chat(db: AsyncSession, request: ChatRequest) -> AsyncIterator[bytes]:
    sanitized_message = _sanitize_input(request.message, 2000)
    if not sanitized_message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid message")

    sanitized_history = [
        {"role": m.role, "content": _sanitize_input(m.content, 2000)}
        for m in (request.conversationHistory or [])
    ][-10:]

    portfolio_context, hero, resume_url = await _build_portfolio_context(db, request.contentMode)
    owner_name = hero.name if hero else "this portfolio"

    system_prompt = f"""You are a friendly and professional AI assistant for {owner_name}'s portfolio website. Your role is to help visitors learn about the portfolio owner, their skills, projects, experience, and services.

Here is the complete portfolio information you have access to:
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

    messages = [{"role": "system", "content": system_prompt}, *sanitized_history, {"role": "user", "content": sanitized_message}]

    async for chunk in ai_gateway.stream_chat_completion(messages, model=CHAT_MODEL):
        yield chunk
