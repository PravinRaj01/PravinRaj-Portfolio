# app/services/github_repo.py -- reads a GitHub repository for the admin's
# "import a project from GitHub" tool (AI v2, Phase 5).
#
# Safety: the only host ever contacted is api.github.com, and every request URL
# is built here from an owner/repo pair that passed a strict allowlist. The
# admin's pasted text is never used as a URL (no SSRF), and repository content
# is returned as plain data for the caller to treat as untrusted.
#
# Errors map to what the admin needs to know: a bad URL (400), a repository that
# doesn't exist or is private (404), GitHub's anonymous rate limit (429), or
# GitHub being unreachable (502). A GITHUB_TOKEN raises the anonymous limit
# from 60 to 5000 requests an hour and allows the owner's private repos.
import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

API = "https://api.github.com"
_TIMEOUT = httpx.Timeout(10.0, connect=5.0)

README_LIMIT = 12_000
MANIFEST_LIMIT = 4_000
MAX_TREE_PATHS = 300
MAX_MANIFESTS = 5
_MAX_MANIFEST_FILE_BYTES = 200_000
_MAX_TREE_DEPTH = 4

_NAME = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")
_URL = re.compile(r"^(?:https?://)?(?:www\.)?github\.com/([^/?#\s]+)/([^/?#\s]+)(?:[/?#].*)?$", re.IGNORECASE)
_SHORTHAND = re.compile(r"^([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$")

# Files that say what a project is built with, most informative first.
_MANIFEST_NAMES = (
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "Gemfile",
    "composer.json",
    "Dockerfile",
    "docker-compose.yml",
    "vercel.json",
)
_SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", ".next", ".nuxt", "venv", ".venv", "__pycache__", "vendor",
    "target", ".idea", ".vscode", "coverage", ".cache", "out", "bin", "obj", "Pods", ".gradle",
    "site-packages", ".pytest_cache", ".mypy_cache",
}
_SKIP_SUFFIXES = (
    ".lock", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".mp4", ".mov", ".mp3", ".woff",
    ".woff2", ".ttf", ".eot", ".pdf", ".zip", ".gz", ".map", ".min.js", ".pyc", ".class", ".jar",
)
_SKIP_NAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock", "poetry.lock",
    "Pipfile.lock", "Cargo.lock", "uv.lock", ".DS_Store",
}


class RepoUrlError(ValueError):
    """The pasted text isn't a GitHub repository URL."""


class RepoNotFoundError(RuntimeError):
    pass


class RepoRateLimitedError(RuntimeError):
    def __init__(self, reset_at: str | None = None) -> None:
        super().__init__("GitHub's rate limit was reached")
        self.reset_at = reset_at


class GitHubUnavailableError(RuntimeError):
    pass


@dataclass
class RepoDigest:
    owner: str
    name: str
    full_name: str
    html_url: str
    description: str | None
    homepage: str | None
    topics: list[str]
    language: str | None
    languages: dict[str, int]  # language -> bytes
    stars: int
    forks: int
    created_at: str | None
    pushed_at: str | None
    default_branch: str
    archived: bool
    is_fork: bool
    license: str | None
    readme: str | None
    file_paths: list[str]
    tree_truncated: bool
    manifests: dict[str, str] = field(default_factory=dict)


def parse_repo_url(raw: str) -> tuple[str, str]:
    """`https://github.com/owner/repo(.git)(/anything)` or `owner/repo` -> (owner, repo)."""
    text = (raw or "").strip()
    match = _URL.match(text) or _SHORTHAND.match(text)
    if not match:
        raise RepoUrlError("Enter a GitHub repository URL like https://github.com/owner/repo")
    owner, repo = match.group(1), match.group(2)
    if repo.lower().endswith(".git"):
        repo = repo[:-4]
    for part in (owner, repo):
        if part in {".", ".."} or not _NAME.match(part):
            raise RepoUrlError("That doesn't look like a valid GitHub repository name")
    return owner, repo


def _headers(*, raw: bool = False) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github.raw+json" if raw else "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gg-portfolio-project-importer",
    }
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    return headers


async def _get(
    client: httpx.AsyncClient, path: str, *, raw: bool = False, params: dict[str, str] | None = None
) -> httpx.Response | None:
    """One GitHub API call. None means 404 (callers decide whether that matters)."""
    try:
        response = await client.get(f"{API}{path}", headers=_headers(raw=raw), params=params)
    except httpx.HTTPError as exc:
        raise GitHubUnavailableError("GitHub could not be reached") from exc

    if response.status_code == 404:
        return None
    if response.status_code == 429 or (
        response.status_code == 403 and response.headers.get("x-ratelimit-remaining") == "0"
    ):
        reset = response.headers.get("x-ratelimit-reset")
        reset_at = None
        if reset and reset.isdigit():
            reset_at = datetime.fromtimestamp(int(reset), tz=timezone.utc).isoformat()
        raise RepoRateLimitedError(reset_at)
    if response.status_code == 401:
        raise GitHubUnavailableError("GitHub rejected the configured GITHUB_TOKEN")
    if response.status_code >= 400:
        # Status only; never log the body.
        logger.warning("GitHub API error: HTTP %s for %s", response.status_code, path.split("?")[0])
        raise GitHubUnavailableError(f"GitHub returned HTTP {response.status_code}")
    return response


def interesting_paths(tree: list[dict[str, Any]]) -> list[str]:
    """Source/config files worth showing a model, shallowest first, capped."""
    paths: list[str] = []
    for item in tree:
        if item.get("type") != "blob" or not isinstance(item.get("path"), str):
            continue
        path: str = item["path"]
        parts = path.split("/")
        if len(parts) > _MAX_TREE_DEPTH or any(p in _SKIP_DIRS for p in parts[:-1]):
            continue
        name = parts[-1]
        if name in _SKIP_NAMES or name.lower().endswith(_SKIP_SUFFIXES):
            continue
        paths.append(path)
    paths.sort(key=lambda p: (p.count("/"), p.lower()))
    return paths[:MAX_TREE_PATHS]


def pick_manifests(tree: list[dict[str, Any]]) -> list[str]:
    """Paths of up to MAX_MANIFESTS build/dependency files within two levels of the root."""
    found: list[tuple[int, int, str]] = []
    for item in tree:
        path = item.get("path")
        if item.get("type") != "blob" or not isinstance(path, str):
            continue
        size = item.get("size")
        if isinstance(size, int) and size > _MAX_MANIFEST_FILE_BYTES:
            continue
        parts = path.split("/")
        if len(parts) > 2 or any(p in _SKIP_DIRS for p in parts[:-1]) or parts[-1] not in _MANIFEST_NAMES:
            continue
        found.append((len(parts) - 1, _MANIFEST_NAMES.index(parts[-1]), path))
    found.sort()
    return [path for _, _, path in found[:MAX_MANIFESTS]]


async def fetch_repo_digest(owner: str, repo: str) -> RepoDigest:
    """Everything the importer needs about one repository, in a handful of
    parallel requests. Raises RepoNotFoundError / RepoRateLimitedError /
    GitHubUnavailableError."""
    base = f"/repos/{quote(owner, safe='')}/{quote(repo, safe='')}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        meta_response = await _get(client, base)
        if meta_response is None:
            raise RepoNotFoundError(f"{owner}/{repo} was not found")
        meta = meta_response.json()
        branch = meta.get("default_branch") or "main"

        languages_r, readme_r, tree_r = await asyncio.gather(
            _get(client, f"{base}/languages"),
            _get(client, f"{base}/readme", raw=True),
            _get(client, f"{base}/git/trees/{quote(branch, safe='')}", params={"recursive": "1"}),
        )

        languages: dict[str, int] = {}
        if languages_r is not None and isinstance(languages_r.json(), dict):
            languages = {k: int(v) for k, v in languages_r.json().items() if isinstance(v, (int, float))}

        readme = readme_r.text[:README_LIMIT] if readme_r is not None else None

        tree: list[dict[str, Any]] = []
        truncated = False
        if tree_r is not None:
            body = tree_r.json()
            tree = [t for t in body.get("tree") or [] if isinstance(t, dict)]
            truncated = bool(body.get("truncated"))

        manifest_paths = pick_manifests(tree)
        manifest_responses = await asyncio.gather(
            *(
                _get(client, f"{base}/contents/{quote(path, safe='/')}", raw=True, params={"ref": branch})
                for path in manifest_paths
            )
        )
        manifests = {
            path: response.text[:MANIFEST_LIMIT]
            for path, response in zip(manifest_paths, manifest_responses, strict=True)
            if response is not None
        }

    license_info = meta.get("license") if isinstance(meta.get("license"), dict) else None
    return RepoDigest(
        owner=owner,
        name=meta.get("name") or repo,
        full_name=meta.get("full_name") or f"{owner}/{repo}",
        html_url=meta.get("html_url") or f"https://github.com/{owner}/{repo}",
        description=meta.get("description"),
        homepage=meta.get("homepage") or None,
        topics=[t for t in meta.get("topics") or [] if isinstance(t, str)],
        language=meta.get("language"),
        languages=languages,
        stars=int(meta.get("stargazers_count") or 0),
        forks=int(meta.get("forks_count") or 0),
        created_at=meta.get("created_at"),
        pushed_at=meta.get("pushed_at"),
        default_branch=branch,
        archived=bool(meta.get("archived")),
        is_fork=bool(meta.get("fork")),
        license=(license_info or {}).get("spdx_id") if license_info else None,
        readme=readme,
        file_paths=interesting_paths(tree),
        tree_truncated=truncated,
        manifests=manifests,
    )
