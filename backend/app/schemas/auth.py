# app/schemas/auth.py — MIGRATION_PLAN.md Appendix A.7
import uuid

from pydantic import BaseModel, EmailStr   # EmailStr needs pydantic[email]

from app.schemas.common import ORMModel


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminUserRead(ORMModel):           # same shape as AdminUser in src/services/authService.ts
    id: uuid.UUID
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AdminUserRead
