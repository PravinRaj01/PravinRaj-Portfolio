# app/services/storage_r2.py — MIGRATION_PLAN.md §8
#
# aioboto3 S3-compatible client for Cloudflare R2. Scope of this module is
# the storage engine itself (put/delete/URL-building/PDF validation); the
# /resumes router that will actually call this (ResumeManager.tsx's cutover)
# is a separate, not-yet-built phase -- see MIGRATION_PLAN.md §11 step 5.
import aioboto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from app.core.config import settings

PDF_MAGIC_BYTES = b"%PDF"

_session = aioboto3.Session()


def _client():
    return _session.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )


def public_url(key: str) -> str:
    return f"{settings.r2_public_base.rstrip('/')}/{key}"


def key_from_public_url(url: str) -> str | None:
    """Extracts the object key if `url` belongs to our R2 public base,
    else None. Mirrors ResumeManager.tsx's `currentUrl.includes('supabase')`
    check -- only ever delete an object this app actually manages, never an
    arbitrary URL a caller happens to send."""
    base = settings.r2_public_base.rstrip("/") + "/"
    if not url.startswith(base):
        return None
    return url[len(base):]


def is_valid_pdf(data: bytes) -> bool:
    """Checks the real file signature (the first 4 bytes are literally
    "%PDF"), not just the declared Content-Type, which a client can set to
    anything regardless of what the bytes actually are."""
    return data[:4] == PDF_MAGIC_BYTES


async def put_object(
    key: str, data: bytes, content_type: str, cache_control: str = "max-age=3600"
) -> str:
    try:
        async with _client() as client:
            await client.put_object(
                Bucket=settings.r2_bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
                CacheControl=cache_control,
            )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Storage upload failed"
        ) from exc
    return public_url(key)


async def delete_object(key: str) -> None:
    try:
        async with _client() as client:
            await client.delete_object(Bucket=settings.r2_bucket, Key=key)
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Storage delete failed"
        ) from exc
