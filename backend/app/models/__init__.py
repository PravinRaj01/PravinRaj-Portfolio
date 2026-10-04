"""Import every model module so Base.metadata (and Alembic autogenerate) sees
all 22 tables. See MIGRATION_PLAN.md §4 (21 tables) and §13 (admin_login_attempts).
"""

from app.db.base import Base
from app.models.academic import Certification, Education, Experience, TechnicalSkill
from app.models.ai import ChatRequestLog
from app.models.analytics import GameScore, VisitorDailyStats, VisitorStats
from app.models.auth import AdminLoginAttempt, AdminUser
from app.models.content import (
    AboutContent,
    ContactContent,
    GithubTicker,
    HeroContent,
    Service,
    Skill,
    Social,
    Stat,
)
from app.models.magazine import MagazineIssue
from app.models.projects import Project, ProjectFolder, ProjectImageFolder
from app.models.rag import PortfolioChunk
from app.models.site import SiteSettings

__all__ = [
    "Base",
    "AboutContent",
    "HeroContent",
    "ContactContent",
    "Stat",
    "Skill",
    "Service",
    "Social",
    "GithubTicker",
    "Education",
    "Certification",
    "Experience",
    "TechnicalSkill",
    "SiteSettings",
    "ProjectFolder",
    "Project",
    "ProjectImageFolder",
    "MagazineIssue",
    "VisitorStats",
    "VisitorDailyStats",
    "GameScore",
    "AdminUser",
    "AdminLoginAttempt",
    "ChatRequestLog",
    "PortfolioChunk",
]
