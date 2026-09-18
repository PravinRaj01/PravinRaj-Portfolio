"""Seed the first row in admin_users. See MIGRATION_PLAN.md §8/§10.

Supabase's auth.users password hashes aren't portable to this project's new
argon2 scheme (see app/core/security.py), so this is how the first admin
login gets created after the schema migration.

Usage:
    ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... python scripts/create_admin.py
    ADMIN_EMAIL=you@example.com python scripts/create_admin.py   # prompts (hidden input)
    python scripts/create_admin.py                                # prompts for both
    python scripts/create_admin.py --force                        # overwrite if the email already exists

The password is read from the ADMIN_PASSWORD env var or an interactive
getpass() prompt -- never from a plain CLI argument, and never printed or
logged anywhere by this script.
"""

import argparse
import asyncio
import getpass
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.core.security import hash_password
from app.db.session import engine


async def create_admin(email: str, password: str, force: bool) -> None:
    async with engine.begin() as conn:
        existing = (
            await conn.execute(text("SELECT id FROM admin_users WHERE email = :email"), {"email": email})
        ).scalar()

        if existing and not force:
            print(f"ERROR: an admin with email {email} already exists (pass --force to reset their password).")
            sys.exit(1)

        hashed = hash_password(password)

        if existing:
            await conn.execute(
                text("UPDATE admin_users SET password_hash = :hashed, is_active = true WHERE email = :email"),
                {"hashed": hashed, "email": email},
            )
            print(f"Updated password for existing admin: {email}")
        else:
            await conn.execute(
                text(
                    "INSERT INTO admin_users (email, password_hash, is_active) "
                    "VALUES (:email, :hashed, true)"
                ),
                {"email": email, "hashed": hashed},
            )
            print(f"Created admin: {email}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", default=os.environ.get("ADMIN_EMAIL"))
    parser.add_argument("--force", action="store_true", help="Overwrite the password if this email already exists")
    args = parser.parse_args()

    email = args.email or input("Admin email: ").strip()
    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Admin password: ")

    if not email or not password:
        print("ERROR: both email and password are required.")
        sys.exit(1)

    asyncio.run(create_admin(email, password, args.force))


if __name__ == "__main__":
    main()
