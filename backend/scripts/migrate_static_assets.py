"""Bulk-uploads the downloaded Supabase Storage snapshot to Cloudflare R2.

See MIGRATION_PLAN.md §10 step 5 (storage half). Source: the local
`<bucket>.storage/<bucket>/<Pictures|resumes>/...` folder produced by
downloading a Supabase Storage export (e.g.
kadsdqnpxzgdxnnrdzra.storage/kadsdqnpxzgdxnnrdzra/ at the repo root).

Each file's R2 key is its path relative to that inner folder, so
`Pictures/3.png` and `resumes/resume-123.pdf` land at the same relative
keys in R2 -- preserving the original bucket layout. Zero-byte marker
files (e.g. Supabase's `.emptyFolderPlaceholder`) and dotfiles are
skipped, since they're storage-UI artifacts, not real assets.

This only uploads files to R2; it does NOT rewrite any database rows
(e.g. site_settings.*_resume_url still pointing at the old Supabase URLs)
-- that's a deliberately separate step, since it's a different kind of
change (mutating live data references) than copying files.

Usage:
    python scripts/migrate_static_assets.py --dry-run
    python scripts/migrate_static_assets.py                  # uploads for real
    python scripts/migrate_static_assets.py --force           # re-upload even if the key already exists in R2
"""

import argparse
import asyncio
import mimetypes
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import storage_r2  # noqa: E402

# Supabase Storage UI leaves these behind for empty folders; not real assets.
_SKIP_NAMES = {".emptyFolderPlaceholder"}

_CONTENT_TYPE_OVERRIDES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
}


def _content_type_for(path: Path) -> str:
    override = _CONTENT_TYPE_OVERRIDES.get(path.suffix.lower())
    if override:
        return override
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def discover_files(source: Path) -> list[tuple[Path, str]]:
    """Returns [(local_path, r2_key), ...] for every real file under
    `source`, skipping dotfiles/placeholders. r2_key is the path relative
    to `source`, with forward slashes regardless of OS."""
    files = []
    for path in sorted(source.rglob("*")):
        if not path.is_file():
            continue
        if path.name in _SKIP_NAMES or path.name.startswith("."):
            continue
        key = path.relative_to(source).as_posix()
        files.append((path, key))
    return files


async def _key_exists(key: str) -> bool:
    try:
        async with storage_r2._client() as client:
            await client.head_object(Bucket=storage_r2.settings.r2_bucket, Key=key)
        return True
    except Exception:
        return False


async def _upload_all(files: list[tuple[Path, str]], force: bool) -> None:
    uploaded = skipped = failed = 0
    total_bytes = 0

    for local_path, key in files:
        if not force and await _key_exists(key):
            print(f"  (skip, already exists) {key}")
            skipped += 1
            continue

        data = local_path.read_bytes()
        content_type = _content_type_for(local_path)
        try:
            url = await storage_r2.put_object(key, data, content_type=content_type)
            print(f"  uploaded {key} ({len(data):,} bytes, {content_type}) -> {url}")
            uploaded += 1
            total_bytes += len(data)
        except Exception as exc:
            print(f"  FAILED {key}: {exc}")
            failed += 1

    print(
        f"\nDone: {uploaded} uploaded ({total_bytes:,} bytes), "
        f"{skipped} skipped (already present), {failed} failed."
    )
    if failed:
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--source",
        default="../kadsdqnpxzgdxnnrdzra.storage/kadsdqnpxzgdxnnrdzra",
        help="Local folder to walk (the <bucket>/ folder inside the downloaded snapshot)",
    )
    parser.add_argument("--dry-run", action="store_true", help="List what would be uploaded; no R2 writes")
    parser.add_argument(
        "--force", action="store_true", help="Re-upload even if the key already exists in R2"
    )
    args = parser.parse_args()

    source = Path(args.source)
    if not source.is_dir():
        print(f"ERROR: source folder not found: {source}")
        sys.exit(1)

    print(f"Scanning {source} ...")
    files = discover_files(source)

    print(f"\nFound {len(files)} real files:")
    total_bytes = 0
    for local_path, key in files:
        size = local_path.stat().st_size
        total_bytes += size
        print(f"  {key:60s} {size:>10,} bytes")
    print(f"\nTotal: {len(files)} files, {total_bytes:,} bytes")

    if args.dry_run:
        print("\n--dry-run: stopping before any R2 upload.")
        return

    print(f"\nUploading to R2 bucket '{storage_r2.settings.r2_bucket}' ...")
    asyncio.run(_upload_all(files, args.force))


if __name__ == "__main__":
    main()
