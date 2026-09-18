"""Seed Neon with the historical data from a Supabase pg_dumpall backup.

See MIGRATION_PLAN.md §10. Source: a plain-text pg_dumpall file (e.g.
db_cluster-26-07-2026@19-41-44.backup/db_cluster-26-07-2026@19-41-44.backup)
placed at the repo root or passed via --backup-file.

Design notes
------------
* Each table's data is a `COPY public.<table> (<cols>) FROM stdin; ... \\.`
  block using Postgres's native COPY TEXT format. Rather than re-implementing
  that format's escaping rules (backslash escapes, \\N nulls, nested Postgres
  array/jsonb literal syntax -- all real, all easy to get subtly wrong), this
  script extracts each block's data verbatim and hands the raw bytes to
  asyncpg's `Connection.copy_to_table(source=...)`, which speaks Postgres's
  COPY protocol directly. Postgres itself does the parsing, so this is
  exactly as correct as the original pg_dump/pg_restore round-trip.
* Requires the Alembic baseline migration to already be applied (real tables
  must exist) -- checked before anything else runs.
* Refuses to run against a table that already has rows, unless --force is
  given, to make accidental double-seeding hard.
* Triggers are disabled for the duration of the load (`SET LOCAL
  session_replication_role = replica`) so the 7 real update_updated_at
  triggers (see alembic/versions/*_baseline.py) don't overwrite the original
  historical updated_at values with "now".
* admin_users is intentionally not seeded here -- see scripts/create_admin.py
  (Supabase's password hashes aren't portable to our new argon2 scheme).
* --dry-run parses and validates row counts against the backup without
  opening a database connection at all.

Usage:
    python scripts/copy_supabase_data.py --dry-run
    python scripts/copy_supabase_data.py                  # applies for real
    python scripts/copy_supabase_data.py --force           # bypass the "table not empty" guard
"""

import argparse
import asyncio
import io
import re
import sys
from pathlib import Path

# Allow running this script directly (`python scripts/copy_supabase_data.py`)
# without installing the `app` package first.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import asyncpg

from app.core.config import settings

# FK-safe order: project_folders before projects before project_image_folders.
# Every other table is independent of the others.
LOAD_ORDER = [
    "project_folders",
    "projects",
    "project_image_folders",
    "about_content",
    "certifications",
    "contact_content",
    "education",
    "experiences",
    "game_scores",
    "github_ticker",
    "hero_content",
    "magazine_issues",
    "services",
    "site_settings",
    "skills",
    "socials",
    "stats",
    "technical_skills",
    "visitor_daily_stats",
    "visitor_stats",
]

COPY_HEADER_RE = re.compile(
    r"^COPY public\.(?P<table>\w+) \((?P<cols>[^)]*)\) FROM stdin;\r?\n$"
)


def parse_backup(path: Path) -> dict[str, tuple[list[str], bytes]]:
    """Extract {table_name: (columns, raw_copy_data_bytes)} for every
    `COPY public.<table> (...) FROM stdin; ... \\.` block in the dump.
    The returned bytes are the exact COPY payload (no interpretation),
    ready to hand to asyncpg.Connection.copy_to_table(source=...)."""
    tables: dict[str, tuple[list[str], bytes]] = {}
    with open(path, "rb") as f:
        raw = f.read()

    # Work line-by-line but keep original bytes (the file may contain
    # non-UTF8-safe bytes in text fields; COPY format handles that natively).
    lines = raw.split(b"\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith(b"COPY public."):
            header = line.decode("utf-8") + "\n"
            m = COPY_HEADER_RE.match(header)
            if m:
                table = m.group("table")
                # pg_dump double-quotes reserved-ish column names in the COPY
                # header (e.g. "position" on projects); asyncpg's copy_to_table
                # quotes each column itself, so strip pg_dump's quotes here or
                # they'd double up into a broken identifier.
                cols = [c.strip().strip('"') for c in m.group("cols").split(",")]
                data_lines = []
                i += 1
                while i < len(lines) and lines[i] != b"\\.":
                    data_lines.append(lines[i])
                    i += 1
                # Re-join with \n; add trailing newline (COPY text format wants
                # one) unless the block was empty.
                body = b"\n".join(data_lines)
                if data_lines:
                    body += b"\n"
                tables[table] = (cols, body)
        i += 1
    return tables


def count_rows(data: bytes) -> int:
    if not data:
        return 0
    return data.count(b"\n")


async def _load(args: argparse.Namespace, tables: dict[str, tuple[list[str], bytes]]) -> None:
    dsn = settings.database_url_direct.replace("postgresql+asyncpg://", "postgresql://", 1)
    conn = await asyncpg.connect(dsn, ssl="require")
    try:
        # 1) Prerequisite: real tables must already exist (migration applied).
        missing = [
            t for t in LOAD_ORDER
            if not await conn.fetchval(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name=$1)", t
            )
        ]
        if missing:
            print(f"ERROR: these tables don't exist yet -- run `alembic upgrade head` first: {missing}")
            sys.exit(1)

        # 2) Refuse to double-seed unless --force.
        if not args.force:
            nonempty = []
            for t in LOAD_ORDER:
                n = await conn.fetchval(f"SELECT count(*) FROM public.{t}")
                if n > 0:
                    nonempty.append((t, n))
            if nonempty:
                print(f"ERROR: these tables already have rows (pass --force to load anyway): {nonempty}")
                sys.exit(1)

        # 3) Load, with triggers off, in one transaction. Neon doesn't grant
        # superuser, so `SET session_replication_role = replica` is refused
        # (InsufficientPrivilegeError); ALTER TABLE ... DISABLE TRIGGER USER
        # works instead, since neondb_owner owns these tables, and it only
        # touches user-defined triggers -- FK-enforcement triggers stay on.
        # Both the disable and the re-enable are DDL inside this same
        # transaction, so a failure anywhere rolls everything back together,
        # including the disable itself.
        async with conn.transaction():
            for table in LOAD_ORDER:
                await conn.execute(f"ALTER TABLE public.{table} DISABLE TRIGGER USER")
            for table in LOAD_ORDER:
                if table not in tables:
                    print(f"  (skip) {table}: not present in backup")
                    continue
                cols, data = tables[table]
                if not data:
                    print(f"  (skip) {table}: 0 rows in backup")
                    continue
                result = await conn.copy_to_table(
                    table, source=io.BytesIO(data), columns=cols, format="text"
                )
                print(f"  loaded {table}: {result}")
            for table in LOAD_ORDER:
                await conn.execute(f"ALTER TABLE public.{table} ENABLE TRIGGER USER")

        # 4) Verify counts.
        print("\nVerifying row counts:")
        mismatches = 0
        for table in LOAD_ORDER:
            expected = count_rows(tables.get(table, ([], b""))[1])
            actual = await conn.fetchval(f"SELECT count(*) FROM public.{table}")
            status = "OK" if actual == expected else "MISMATCH"
            if status == "MISMATCH":
                mismatches += 1
            print(f"  {table:28s} expected={expected:4d} actual={actual:4d} {status}")
        if mismatches:
            print(f"\n{mismatches} table(s) mismatched -- investigate before trusting this data.")
            sys.exit(1)
        print("\nAll row counts match. Seeding complete.")
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--backup-file",
        default="../db_cluster-26-07-2026@19-41-44.backup/db_cluster-26-07-2026@19-41-44.backup",
        help="Path to the pg_dumpall text backup file",
    )
    parser.add_argument("--dry-run", action="store_true", help="Parse and report only; no database connection")
    parser.add_argument("--force", action="store_true", help="Load even if target tables already have rows")
    args = parser.parse_args()

    backup_path = Path(args.backup_file)
    if not backup_path.is_file():
        print(f"ERROR: backup file not found: {backup_path}")
        sys.exit(1)

    print(f"Parsing {backup_path} ...")
    tables = parse_backup(backup_path)

    print(f"\nFound {len(tables)} public-schema COPY blocks:")
    for table in LOAD_ORDER:
        if table in tables:
            cols, data = tables[table]
            print(f"  {table:28s} {len(cols):2d} cols, {count_rows(data):4d} rows")
        else:
            print(f"  {table:28s} NOT FOUND IN BACKUP")

    unexpected = set(tables) - set(LOAD_ORDER)
    if unexpected:
        print(f"\nNote: backup also has COPY blocks not in LOAD_ORDER (ignored): {sorted(unexpected)}")

    if args.dry_run:
        print("\n--dry-run: stopping before any database connection.")
        return

    asyncio.run(_load(args, tables))


if __name__ == "__main__":
    main()
