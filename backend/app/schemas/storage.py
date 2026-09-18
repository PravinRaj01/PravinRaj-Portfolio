# app/schemas/storage.py — MIGRATION_PLAN.md Appendix A.7
from app.schemas.common import Mode
from pydantic import BaseModel


class ResumeResponse(BaseModel):
    mode: Mode
    url: str | None
