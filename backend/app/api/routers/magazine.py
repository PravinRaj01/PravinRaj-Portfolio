# app/api/routers/magazine.py — MIGRATION_PLAN.md §7 (magazine row)
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.magazine import MagazineIssue
from app.schemas.magazine import MagazineIssueCreate, MagazineIssueRead

router = APIRouter(prefix="/magazine", tags=["magazine"])


@router.get("/latest", response_model=MagazineIssueRead | None)
async def get_latest_magazine_issue(db: Annotated[AsyncSession, Depends(get_db)]) -> MagazineIssue | None:
    result = await db.execute(
        select(MagazineIssue)
        .where(MagazineIssue.is_published.is_(True))
        .order_by(MagazineIssue.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.get("", response_model=list[MagazineIssueRead], dependencies=[Depends(require_admin)])
async def list_magazine_issues(db: Annotated[AsyncSession, Depends(get_db)]) -> list[MagazineIssue]:
    result = await db.execute(select(MagazineIssue).order_by(MagazineIssue.created_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=MagazineIssueRead, dependencies=[Depends(require_admin)])
async def create_magazine_issue(
    payload: MagazineIssueCreate, db: Annotated[AsyncSession, Depends(get_db)]
) -> MagazineIssue:
    data = payload.model_dump(mode="json")
    issue = MagazineIssue(**data)
    db.add(issue)
    await db.commit()
    await db.refresh(issue)
    return issue


@router.delete("/{issue_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_magazine_issue(issue_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    issue = await db.get(MagazineIssue, issue_id)
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    await db.delete(issue)
    await db.commit()


@router.post("/{issue_id}/publish", response_model=MagazineIssueRead, dependencies=[Depends(require_admin)])
async def publish_issue(issue_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> MagazineIssue:
    issue = await db.get(MagazineIssue, issue_id)
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    # Single transaction pool: unpublish every currently-published issue and
    # publish this one, both statements committed together on the same
    # session -- an exception anywhere rolls both back, so there's never a
    # window where zero issues (or more than one) are published. Fixes the
    # original useMagazine.publishIssue's two separate Supabase calls
    # (MIGRATION_PLAN.md §1 finding 8).
    await db.execute(
        update(MagazineIssue).where(MagazineIssue.is_published.is_(True)).values(is_published=False)
    )
    issue.is_published = True
    await db.commit()
    await db.refresh(issue)
    return issue


@router.post("/{issue_id}/unpublish", response_model=MagazineIssueRead, dependencies=[Depends(require_admin)])
async def unpublish_issue(issue_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> MagazineIssue:
    issue = await db.get(MagazineIssue, issue_id)
    if issue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    issue.is_published = False
    await db.commit()
    await db.refresh(issue)
    return issue
