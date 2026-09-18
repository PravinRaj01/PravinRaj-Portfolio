"""Confirms the /resumes/{mode} upload/delete lifecycle against the real,
live R2 bucket (no mocking, same discipline as the rest of this suite) --
PDF validation (content-type AND real magic bytes), that uploading a new
resume deletes the previous R2 object it owned, and that DELETE clears
both the object and the site_settings field.

site_settings is a live singleton row with real values already in
professional_resume_url/creative_resume_url (currently old
Supabase-hosted URLs, confirmed not R2-managed, so this suite's uploads
never touch them) -- every test restores the original value in a finally
block and deletes any R2 objects it created along the way.
"""

import asyncio

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import engine
from app.services import storage_r2
from main import app

client = TestClient(app)

# A minimal but genuinely valid single-page PDF (not just b"%PDF" -- a real
# structure a PDF reader can open), so storage_r2.is_valid_pdf's magic-byte
# check and any downstream real-world viewer both accept it.
_MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
    b"trailer<</Root 1 0 R>>\n"
    b"%%EOF"
)


async def _get_resume_url(mode: str) -> str | None:
    field = "professional_resume_url" if mode == "professional" else "creative_resume_url"
    async with engine.connect() as conn:
        result = await conn.execute(text(f"SELECT {field} FROM site_settings LIMIT 1"))
        return result.scalar_one_or_none()


async def _restore_resume_url(mode: str, url: str | None) -> None:
    field = "professional_resume_url" if mode == "professional" else "creative_resume_url"
    async with engine.begin() as conn:
        await conn.execute(text(f"UPDATE site_settings SET {field} = :url"), {"url": url})


async def _object_exists(key: str) -> bool:
    try:
        async with storage_r2._client() as s3:
            await s3.head_object(Bucket=storage_r2.settings.r2_bucket, Key=key)
        return True
    except Exception:
        return False


def test_upload_requires_admin():
    r = client.post(
        "/api/v1/resumes/professional",
        files={"file": ("resume.pdf", _MINIMAL_PDF, "application/pdf")},
    )
    assert r.status_code == 401


def test_upload_rejects_wrong_content_type(admin_headers):
    r = client.post(
        "/api/v1/resumes/creative",
        files={"file": ("resume.pdf", _MINIMAL_PDF, "text/plain")},
        headers=admin_headers,
    )
    assert r.status_code == 400
    assert "PDF" in r.json()["detail"]


def test_upload_rejects_fake_pdf_bytes(admin_headers):
    # Correct declared content-type, but the actual bytes aren't a PDF --
    # this is the real guard (MIGRATION_PLAN.md §8), not the header above.
    r = client.post(
        "/api/v1/resumes/creative",
        files={"file": ("resume.pdf", b"not a real pdf at all", "application/pdf")},
        headers=admin_headers,
    )
    assert r.status_code == 400
    assert "valid PDF" in r.json()["detail"]


def test_upload_and_delete_lifecycle(admin_headers):
    mode = "creative"
    original_url = asyncio.run(_get_resume_url(mode))

    # Point the DB field at a synthetic, definitely-non-R2 placeholder before
    # the lifecycle runs. The upload endpoint deletes whatever R2 object the
    # *current* URL points at when it detects the field already owns one --
    # if the real seeded value here happens to already be R2-hosted (e.g.
    # after a prior data migration), running straight against it would let
    # this test delete a real, live resume object. The placeholder decouples
    # the test from whatever the live data currently is; the true original
    # is restored in `finally` regardless of which branch we took.
    asyncio.run(_restore_resume_url(mode, "https://example.com/placeholder-test-resume.pdf"))

    uploaded_keys: list[str] = []
    try:
        # First upload.
        r1 = client.post(
            "/api/v1/resumes/creative",
            files={"file": ("resume.pdf", _MINIMAL_PDF, "application/pdf")},
            headers=admin_headers,
        )
        assert r1.status_code == 200
        body1 = r1.json()
        assert body1["mode"] == "creative"
        assert body1["url"].startswith("https://")
        key1 = body1["url"].rsplit("/", 1)[-1]
        uploaded_keys.append(f"resumes/{key1}")

        assert asyncio.run(_object_exists(f"resumes/{key1}")), "uploaded object should exist in R2"
        assert asyncio.run(_get_resume_url(mode)) == body1["url"]

        # Second upload: must delete the first object (which we own) and
        # replace the DB field with the new URL.
        r2 = client.post(
            "/api/v1/resumes/creative",
            files={"file": ("resume.pdf", _MINIMAL_PDF, "application/pdf")},
            headers=admin_headers,
        )
        assert r2.status_code == 200
        body2 = r2.json()
        key2 = body2["url"].rsplit("/", 1)[-1]
        uploaded_keys.append(f"resumes/{key2}")

        assert body2["url"] != body1["url"]
        assert not asyncio.run(_object_exists(f"resumes/{key1}")), (
            "old resume object should have been deleted when a new one was uploaded"
        )
        assert asyncio.run(_object_exists(f"resumes/{key2}"))
        assert asyncio.run(_get_resume_url(mode)) == body2["url"]

        # Delete: clears both the R2 object and the DB field.
        r3 = client.delete("/api/v1/resumes/creative", headers=admin_headers)
        assert r3.status_code == 200
        assert r3.json() == {"mode": "creative", "url": None}
        assert asyncio.run(_get_resume_url(mode)) is None
        assert not asyncio.run(_object_exists(f"resumes/{key2}"))
    finally:
        asyncio.run(_restore_resume_url(mode, original_url))
        # Belt-and-suspenders cleanup in case an assertion failed mid-test
        # before the endpoint's own delete step ran. Swallow errors here --
        # a cleanup failure must never mask whatever the test body raised.
        for key in uploaded_keys:
            try:
                asyncio.run(storage_r2.delete_object(key))
            except Exception:
                pass

    assert asyncio.run(_get_resume_url(mode)) == original_url


def test_delete_requires_admin():
    r = client.delete("/api/v1/resumes/professional")
    assert r.status_code == 401
