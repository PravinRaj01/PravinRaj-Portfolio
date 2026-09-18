# app/api/routers/projects.py — MIGRATION_PLAN.md §7 (projects row)
import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_optional_admin, require_admin
from app.models.auth import AdminUser
from app.models.projects import Project
from app.schemas.common import Mode
from app.schemas.projects import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])

# Same two regexes as the 2026-02-19 migration's slug backfill:
# lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
_SLUG_STRIP_RE = re.compile(r"[^a-zA-Z0-9\s-]")
_SLUG_WHITESPACE_RE = re.compile(r"\s+")


def _slugify(title: str) -> str:
    stripped = _SLUG_STRIP_RE.sub("", title)
    hyphenated = _SLUG_WHITESPACE_RE.sub("-", stripped)
    return hyphenated.lower()


async def _unique_slug(db: AsyncSession, title: str) -> str:
    base = _slugify(title)
    slug = base
    suffix = 1
    while await db.scalar(select(Project.id).where(Project.slug == slug)) is not None:
        suffix += 1
        slug = f"{base}-{suffix}"
    return slug


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser | None, Depends(get_optional_admin)],
    mode: Mode | None = None,
    include_inactive: bool = False,
) -> list[Project]:
    # include_inactive is admin-only per the plan; silently ignored (treated
    # as false) for anyone without a valid token, same pattern as
    # project_folders.
    honor_inactive = include_inactive and admin is not None
    stmt = select(Project).order_by(Project.order_index)
    if not honor_inactive:
        stmt = stmt.where(Project.is_active.is_(True))
    if mode is not None:
        stmt = stmt.where(Project.mode == mode)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/by-slug/{slug}", response_model=ProjectRead)
async def get_project_by_slug(slug: str, db: Annotated[AsyncSession, Depends(get_db)]) -> Project:
    result = await db.execute(
        select(Project).where(Project.slug == slug, Project.is_active.is_(True))
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("", response_model=ProjectRead, dependencies=[Depends(require_admin)])
async def create_project(
    payload: ProjectCreate, db: Annotated[AsyncSession, Depends(get_db)]
) -> Project:
    data = payload.model_dump()
    # Auto-generate + dedupe a slug from the title when none was given,
    # same behavior as the 2026-02-19 migration's backfill.
    if not data.get("slug"):
        data["slug"] = await _unique_slug(db, payload.title)
    row = Project(**data)
    db.add(row)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Constraint violation") from exc
    await db.refresh(row)
    return row


@router.patch("/{item_id}", response_model=ProjectRead, dependencies=[Depends(require_admin)])
async def update_project(
    item_id: uuid.UUID, payload: ProjectUpdate, db: Annotated[AsyncSession, Depends(get_db)]
) -> Project:
    row = await db.get(Project, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Constraint violation") from exc
    await db.refresh(row)
    return row


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_project(item_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    row = await db.get(Project, item_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    # project_image_folders.project_id has ON DELETE CASCADE, so a project's
    # image folders are removed automatically with it.
    await db.delete(row)
    await db.commit()
