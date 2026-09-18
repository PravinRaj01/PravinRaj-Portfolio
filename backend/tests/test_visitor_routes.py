"""Confirms /visitors is atomic under real concurrency (no lost updates)
and that GET/POST agree on the shape the frontend expects.

Uses httpx.AsyncClient + ASGITransport (not TestClient) specifically so the
N increment requests below genuinely overlap in the event loop instead of
running one at a time -- TestClient's sync interface can't produce that.
This is the actual race the original track-visitor Edge Function had (read
view_count, add 1 in JS, write it back); the fix is two atomic SQL
statements (UPDATE...RETURNING / INSERT...ON CONFLICT...RETURNING) rather
than a read-modify-write round trip, so this test is only meaningful
against the real database, not a mock.
"""

import asyncio

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from main import app

client = TestClient(app)

CONCURRENT_REQUESTS = 50


def test_get_visitors_shape():
    r = client.get("/api/v1/visitors")
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"success", "count", "todayCount"}
    assert body["success"] is True
    assert isinstance(body["count"], int)
    assert isinstance(body["todayCount"], int)


def test_increment_shape_and_moves_counter():
    before = client.get("/api/v1/visitors").json()
    r = client.post("/api/v1/visitors/increment")
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"success", "count", "todayCount"}
    assert body["count"] == before["count"] + 1
    assert body["todayCount"] == before["todayCount"] + 1


@pytest.mark.asyncio
async def test_concurrent_increments_are_atomic():
    baseline = client.get("/api/v1/visitors").json()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        responses = await asyncio.gather(
            *[ac.post("/api/v1/visitors/increment") for _ in range(CONCURRENT_REQUESTS)]
        )

    assert all(r.status_code == 200 for r in responses)

    after = client.get("/api/v1/visitors").json()
    assert after["count"] == baseline["count"] + CONCURRENT_REQUESTS, (
        "lost updates: final count should be exactly baseline + N, "
        f"got baseline={baseline['count']} after={after['count']} N={CONCURRENT_REQUESTS}"
    )
    assert after["todayCount"] == baseline["todayCount"] + CONCURRENT_REQUESTS, (
        "lost updates on the daily counter"
    )

    # Every individual response should also have reported a distinct,
    # monotonically consistent count -- i.e. no two concurrent requests were
    # handed back the same "count" value (which would mean one overwrote
    # the other rather than both being serialized).
    counts = sorted(r.json()["count"] for r in responses)
    assert counts == list(range(baseline["count"] + 1, baseline["count"] + CONCURRENT_REQUESTS + 1)), (
        "duplicate or skipped count values returned across concurrent requests"
    )


# --- /visitors/daily ------------------------------------------------------

def test_daily_stats_requires_admin():
    r = client.get("/api/v1/visitors/daily")
    assert r.status_code == 401


def test_daily_stats_shape_and_ordering(admin_headers):
    r = client.get("/api/v1/visitors/daily", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    for row in body:
        assert set(row.keys()) == {"id", "date", "view_count", "created_at"}
    dates = [row["date"] for row in body]
    assert dates == sorted(dates), "expected ascending date order"


def test_daily_stats_range_filters_are_narrower_or_equal(admin_headers):
    all_rows = client.get("/api/v1/visitors/daily", headers=admin_headers, params={"range": "all"}).json()
    last_30 = client.get("/api/v1/visitors/daily", headers=admin_headers, params={"range": "30days"}).json()
    last_7 = client.get("/api/v1/visitors/daily", headers=admin_headers, params={"range": "7days"}).json()

    assert len(last_7) <= len(last_30) <= len(all_rows)
    # Today's row was just created by the increment tests above, so it must
    # appear in every range.
    today = client.get("/api/v1/visitors").json()
    for rows in (all_rows, last_30, last_7):
        assert any(row["view_count"] > 0 for row in rows), "expected at least today's row to be present"
    assert today["todayCount"] > 0


def test_daily_stats_invalid_range_422(admin_headers):
    r = client.get("/api/v1/visitors/daily", headers=admin_headers, params={"range": "bogus"})
    assert r.status_code == 422
