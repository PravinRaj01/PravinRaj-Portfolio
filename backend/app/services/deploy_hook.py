# app/services/deploy_hook.py — SEO_GEO_PLAN.md Phase 2.
#
# After an admin content write, ping the frontend's Vercel Deploy Hook so the
# prerendered static output (scripts/prerender.ts) picks up the change on the
# next build. Best-effort by design: a slow or failing rebuild trigger must
# never fail or delay the admin's actual save (main.py's middleware awaits
# this after the real response has already been computed).
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def trigger_rebuild() -> None:
    if not settings.vercel_deploy_hook_url:
        return

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(settings.vercel_deploy_hook_url)
        if not response.is_success:
            logger.warning("Deploy hook returned %s", response.status_code)
    except httpx.HTTPError:
        logger.exception("Failed to trigger deploy hook")
