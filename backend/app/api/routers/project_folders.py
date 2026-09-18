# app/api/routers/project_folders.py — MIGRATION_PLAN.md §7 (project-folders row)
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_optional_admin, require_admin
from app.models.auth import AdminUser
from app.models.projects import Project, ProjectFolder
from app.schemas.common import Mode, ReorderItem
from app.schemas.projects import ProjectFolderCreate, ProjectFolderRead, ProjectFolderUpdate

router = APIRouter(prefix="/project-folders", tags=["project-folders"])


@router.get("", response_model=list[ProjectFolderRead])
async def list_project_folders(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser | None, Depends(get_optional_admin)],
    mode: Mode | None = None,
    include_inactive: bool = False,
) -> list[ProjectFolderRead]:
    # include_inactive is admin-only per the plan (P for the endpoint itself,
    # A for seeing inactive/draft folders); an unauthenticated caller passing
    # the flag is silently treated as false rather than erroring.
    honor_inactive = include_inactive and admin is not None

    # One query with a GROUP BY subquery instead of the original N+1 (one
    # count query per folder) -- MIGRATION_PLAN.md §1 finding 8.
    count_subq = (
        select(Project.folder_id, func.count(Project.id).label("project_count"))
        .where(Project.is_active.is_(True))
        .group_by(Project.folder_id)
        .subquery()
    )
    stmt = (
        select(ProjectFolder, func.coalesce(count_subq.c.project_count, 0))
        .outerjoin(count_subq, ProjectFolder.id == count_subq.c.folder_id)
        .order_by(ProjectFolder.order_index)
    )
    if not honor_inactive:
        stmt = stmt.where(ProjectFolder.is_active.is_(True))
    if mode is not None:
        stmt = stmt.where(ProjectFolder.mode == mode)

    rows = (await db.execute(stmt)).all()
    results = []
    for folder, count in rows:
        read = ProjectFolderRead.model_validate(folder)
        read.project_count = count or 0
        results.append(read)
    return results


@router.post("", response_model=ProjectFolderRead, dependencies=[Depends(require_admin)])
async def create_project_folder(
    payload: ProjectFolderCreate, db: Annotated[AsyncSession, Depends(get_db)]
) -> ProjectFolderRead:
    folder = ProjectFolder(**payload.model_dump())
    db.add(folder)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Constraint violation") from exc
    await db.refresh(folder)
    read = ProjectFolderRead.model_validate(folder)
    read.project_count = 0
    return read


@router.patch("/{folder_id}", response_model=ProjectFolderRead, dependencies=[Depends(require_admin)])
async def update_project_folder(
    folder_id: uuid.UUID, payload: ProjectFolderUpdate, db: Annotated[AsyncSession, Depends(get_db)]
) -> ProjectFolderRead:
    folder = await db.get(ProjectFolder, folder_id)
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(folder, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Constraint violation") from exc
    await db.refresh(folder)

    count = await db.scalar(
        select(func.count(Project.id)).where(Project.folder_id == folder.id, Project.is_active.is_(True))
    )
    read = ProjectFolderRead.model_validate(folder)
    read.project_count = count or 0
    return read


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_project_folder(folder_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    folder = await db.get(ProjectFolder, folder_id)
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    # projects.folder_id has ON DELETE SET NULL, so member projects survive
    # with folder_id cleared rather than being deleted or blocking this.
    await db.delete(folder)
    await db.commit()


@router.put("/reorder", dependencies=[Depends(require_admin)])
async def reorder_project_folders(
    items: list[ReorderItem], db: Annotated[AsyncSession, Depends(get_db)]
) -> dict[str, bool]:
    # One transaction for every folder's new order_index, instead of the
    # original N sequential UPDATE calls -- MIGRATION_PLAN.md §1 finding 8.
    for item in items:
        await db.execute(
            update(ProjectFolder).where(ProjectFolder.id == item.id).values(order_index=item.order_index)
        )
    await db.commit()
    return {"success": True}
