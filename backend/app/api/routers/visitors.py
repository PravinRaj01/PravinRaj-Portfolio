# app/api/routers/visitors.py — MIGRATION_PLAN.md §7: POST /visitors/increment, GET /visitors, GET /visitors/daily
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.analytics import VisitorDailyStats
from app.schemas.analytics import VisitorCounts, VisitorDailyStatsRead
from app.services import visitor as visitor_service

router = APIRouter(prefix="/visitors", tags=["visitors"])

DailyRange = Literal["7days", "30days", "all"]


@router.post("/increment", response_model=VisitorCounts)
async def increment_visitor(db: Annotated[AsyncSession, Depends(get_db)]) -> VisitorCounts:
    total, today = await visitor_service.increment(db)
    return VisitorCounts(count=total, todayCount=today)


@router.get("", response_model=VisitorCounts)
async def get_visitor_counts(db: Annotated[AsyncSession, Depends(get_db)]) -> VisitorCounts:
    total, today = await visitor_service.get_counts(db)
    return VisitorCounts(count=total, todayCount=today)


@router.get("/daily", response_model=list[VisitorDailyStatsRead], dependencies=[Depends(require_admin)])
async def get_daily_visitor_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    range_: Annotated[DailyRange, Query(alias="range")] = "7days",
) -> list[VisitorDailyStats]:
    return await visitor_service.get_daily_stats(db, range_)
