# main.py — MIGRATION_PLAN.md §2, §7
#
# Run with: uvicorn main:app --reload   (per CLAUDE.md's "Future Backend Commands")
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.services.deploy_hook import trigger_rebuild

from app.api.routers.about import router as about_router
from app.api.routers.ai import router as ai_router
from app.api.routers.auth import router as auth_router
from app.api.routers.certifications import router as certifications_router
from app.api.routers.contact import router as contact_router
from app.api.routers.drive import router as drive_router
from app.api.routers.education import router as education_router
from app.api.routers.experiences import router as experiences_router
from app.api.routers.game_scores import router as game_scores_router
from app.api.routers.github_ticker import router as github_ticker_router
from app.api.routers.hero import router as hero_router
from app.api.routers.magazine import router as magazine_router
from app.api.routers.project_folders import router as project_folders_router
from app.api.routers.project_image_folders import router as project_image_folders_router
from app.api.routers.projects import router as projects_router
from app.api.routers.resumes import router as resumes_router
from app.api.routers.services import router as services_router
from app.api.routers.site_settings import router as site_settings_router
from app.api.routers.skills import router as skills_router
from app.api.routers.socials import router as socials_router
from app.api.routers.stats import router as stats_router
from app.api.routers.technical_skills import router as technical_skills_router
from app.api.routers.visitors import router as visitors_router
from app.core.config import settings

_IS_PRODUCTION = settings.environment == "production"

# The interactive docs enumerate every admin route and schema, so they're
# switched off in production. /health stays available either way.
app = FastAPI(
    title="gg-portfolio API",
    docs_url=None if _IS_PRODUCTION else "/docs",
    redoc_url=None if _IS_PRODUCTION else "/redoc",
    openapi_url=None if _IS_PRODUCTION else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    # Vercel preview deployments get a generated hostname, so they can only be
    # matched by pattern. None (not "") when unset, or Starlette treats the
    # empty string as a regex that matches every origin's prefix.
    allow_origin_regex=settings.cors_origin_regex or None,
    # Auth is a bearer token in the Authorization header; no cookies are ever
    # sent, so credentialed requests don't need to be allowed.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(about_router, prefix="/api/v1")
app.include_router(hero_router, prefix="/api/v1")
app.include_router(skills_router, prefix="/api/v1")
app.include_router(services_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(contact_router, prefix="/api/v1")
app.include_router(stats_router, prefix="/api/v1")
app.include_router(socials_router, prefix="/api/v1")
app.include_router(github_ticker_router, prefix="/api/v1")
app.include_router(education_router, prefix="/api/v1")
app.include_router(certifications_router, prefix="/api/v1")
app.include_router(experiences_router, prefix="/api/v1")
app.include_router(technical_skills_router, prefix="/api/v1")
app.include_router(site_settings_router, prefix="/api/v1")
app.include_router(visitors_router, prefix="/api/v1")
app.include_router(game_scores_router, prefix="/api/v1")
app.include_router(project_folders_router, prefix="/api/v1")
app.include_router(project_image_folders_router, prefix="/api/v1")
app.include_router(magazine_router, prefix="/api/v1")
app.include_router(resumes_router, prefix="/api/v1")
app.include_router(drive_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")

_CONTENT_MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
# Mutating routes that are never publishable content -- hit on every ordinary
# page view (visitors, game-scores) or otherwise unrelated to the prerendered
# site (auth, the AI chatbot, the Drive proxy). Every other admin write goes
# through require_admin and should trigger a rebuild (SEO_GEO_PLAN.md Phase 2).
_NON_CONTENT_PREFIXES = (
    "/api/v1/auth",
    "/api/v1/visitors",
    "/api/v1/game-scores",
    "/api/v1/ai",
    "/api/v1/drive",
)


@app.middleware("http")
async def trigger_rebuild_on_content_write(request: Request, call_next):
    response = await call_next(request)
    if (
        _IS_PRODUCTION
        and request.method in _CONTENT_MUTATION_METHODS
        and response.status_code < 300
        and not request.url.path.startswith(_NON_CONTENT_PREFIXES)
    ):
        await trigger_rebuild()
    return response


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
