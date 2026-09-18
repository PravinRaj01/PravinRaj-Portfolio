# app/api/routers/project_image_folders.py — MIGRATION_PLAN.md §7 (project-image-folders row)
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.projects import ProjectImageFolder
from app.schemas.projects import (
    ProjectImageFolderCreate,
    ProjectImageFolderRead,
    ProjectImageFolderUpdate,
)

router = APIRouter(tags=["project-image-folders"])


@router.get("/projects/{project_id}/image-folders", response_model=list[ProjectImageFolderRead])
async def list_project_image_folders(
    project_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]
) -> list[ProjectImageFolder]:
    result = await db.execute(
        select(ProjectImageFolder)
        .where(ProjectImageFolder.project_id == project_id)
        .order_by(ProjectImageFolder.order_index)
    )
    return list(result.scalars().all())


@router.post(
    "/projects/{project_id}/image-folders",
    response_model=ProjectImageFolderRead,
    dependencies=[Depends(require_admin)],
)
async def create_project_image_folder(
    project_id: uuid.UUID, payload: ProjectImageFolderCreate, db: Annotated[AsyncSession, Depends(get_db)]
) -> ProjectImageFolder:
    # The path's project_id is authoritative -- payload.project_id (also
    # present, since the frontend's ProjectImageFolder type includes it) is
    # not trusted over the URL for a nested-resource create.
    data = payload.model_dump()
    data["project_id"] = project_id
    folder = ProjectImageFolder(**data)
    db.add(folder)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Constraint violation") from exc
    await db.refresh(folder)
    return folder


@router.patch(
    "/image-folders/{image_folder_id}",
    response_model=ProjectImageFolderRead,
    dependencies=[Depends(require_admin)],
)
async def update_project_image_folder(
    image_folder_id: uuid.UUID,
    payload: ProjectImageFolderUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProjectImageFolder:
    folder = await db.get(ProjectImageFolder, image_folder_id)
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image folder not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(folder, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Constraint violation") from exc
    await db.refresh(folder)
    return folder


@router.delete(
    "/image-folders/{image_folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def delete_project_image_folder(
    image_folder_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]
) -> None:
    folder = await db.get(ProjectImageFolder, image_folder_id)
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image folder not found")
    await db.delete(folder)
    await db.commit()
