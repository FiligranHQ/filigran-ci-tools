#!/usr/bin/env python3
"""
opencti_connectors_retag.py

Re-tags all `opencti/connector-*` Docker Hub images so that `latest`
points to a given, already-published version tag.

Strategy (no local Docker daemon required):
  - Uses the Docker Hub v2 API to copy the manifest of <image>:<version>
    onto <image>:latest via a PUT manifest call, authenticated with a
    short-lived JWT obtained from Docker Hub.

Requirements:
    pip install requests

Usage:
    python opencti_connectors_retag.py \
        --version 7.260309.0 \
        --username myuser \
        --password mypassword          # or use --password-stdin / env var

    # Dry-run (no writes):
    python opencti_connectors_retag.py \
        --version 7.260309.0 \
        --username myuser \
        --password mypassword \
        --dry-run
"""

import argparse
import getpass
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DOCKERHUB_NAMESPACE = "opencti"
DOCKERHUB_API_BASE = "https://hub.docker.com/v2"
REGISTRY_BASE = "https://registry-1.docker.io/v2"
AUTH_SERVICE = "registry.docker.io"
AUTH_REALM = "https://auth.docker.io/token"

MAX_WORKERS = 8          # parallel re-tag threads
PAGE_SIZE = 100          # Docker Hub repo listing page size
REQUEST_TIMEOUT = 30     # seconds


# ---------------------------------------------------------------------------
# Docker Hub helpers
# ---------------------------------------------------------------------------

def hub_login(username: str, password: str) -> str:
    """Return a Docker Hub JWT (used for write operations via the Hub API)."""
    resp = requests.post(
        f"{DOCKERHUB_API_BASE}/users/login",
        json={"username": username, "password": password},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["token"]


def get_registry_token(username: str, password: str, repository: str, actions: list[str]) -> str:
    """
    Obtain a short-lived registry bearer token for the given repository
    and requested actions (e.g. ["pull", "push"]).
    """
    scope = f"repository:{repository}:" + ",".join(actions)
    resp = requests.get(
        AUTH_REALM,
        params={"service": AUTH_SERVICE, "scope": scope},
        auth=(username, password),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["token"]


def list_connector_repos(hub_token: str) -> list[str]:
    """
    Return all repository names (without namespace) that start with
    'connector-' from the opencti Docker Hub namespace.
    """
    repos: list[str] = []
    url = f"{DOCKERHUB_API_BASE}/repositories/{DOCKERHUB_NAMESPACE}/"
    params = {"page_size": PAGE_SIZE, "page": 1}

    while url:
        resp = requests.get(
            url,
            params=params,
            headers={"Authorization": f"JWT {hub_token}"},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        for repo in data.get("results", []):
            if repo["name"].startswith("connector-"):
                repos.append(repo["name"])
        url = data.get("next")   # next page URL or None
        params = {}              # next URL already contains page params

    return sorted(repos)


def tag_exists(repo_full: str, tag: str, reg_token: str) -> bool:
    """Check whether a specific tag exists in the registry."""
    resp = requests.head(
        f"{REGISTRY_BASE}/{repo_full}/manifests/{tag}",
        headers={
            "Authorization": f"Bearer {reg_token}",
            "Accept": (
                "application/vnd.docker.distribution.manifest.v2+json,"
                "application/vnd.docker.distribution.manifest.list.v2+json,"
                "application/vnd.oci.image.index.v1+json,"
                "application/vnd.oci.image.manifest.v1+json"
            ),
        },
        timeout=REQUEST_TIMEOUT,
    )
    return resp.status_code == 200


def get_manifest(repo_full: str, tag: str, reg_token: str) -> tuple[str, str]:
    """
    Fetch the raw manifest JSON and its content-type for a given tag.
    Returns (manifest_json_str, content_type).
    """
    accept = (
        "application/vnd.docker.distribution.manifest.list.v2+json,"
        "application/vnd.docker.distribution.manifest.v2+json,"
        "application/vnd.oci.image.index.v1+json,"
        "application/vnd.oci.image.manifest.v1+json"
    )
    resp = requests.get(
        f"{REGISTRY_BASE}/{repo_full}/manifests/{tag}",
        headers={
            "Authorization": f"Bearer {reg_token}",
            "Accept": accept,
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.text, resp.headers["Content-Type"]


def put_manifest(repo_full: str, tag: str, manifest_body: str, content_type: str, reg_token: str) -> None:
    """Push a manifest under a new tag (effectively re-tagging)."""
    resp = requests.put(
        f"{REGISTRY_BASE}/{repo_full}/manifests/{tag}",
        headers={
            "Authorization": f"Bearer {reg_token}",
            "Content-Type": content_type,
        },
        data=manifest_body.encode("utf-8"),
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def retag_connector(
        repo_name: str,
        version: str,
        username: str,
        password: str,
        dry_run: bool,
) -> dict:
    """
    For a single connector repo, copy the manifest of <version> onto `latest`.
    Returns a result dict with keys: repo, status, message.
    """
    repo_full = f"{DOCKERHUB_NAMESPACE}/{repo_name}"
    result = {"repo": repo_full, "status": "ok", "message": ""}

    try:
        # Obtain a registry token with pull+push on this specific repo
        actions = ["pull"] if dry_run else ["pull", "push"]
        reg_token = get_registry_token(username, password, repo_full, actions)

        # Verify the target version tag exists
        if not tag_exists(repo_full, version, reg_token):
            result["status"] = "skipped"
            result["message"] = f"Tag '{version}' not found"
            return result

        if dry_run:
            result["status"] = "dry-run"
            result["message"] = f"Would retag {version} → latest"
            return result

        # Fetch the manifest for the given version
        manifest_body, content_type = get_manifest(repo_full, version, reg_token)

        # Push the same manifest under the `latest` tag
        put_manifest(repo_full, "latest", manifest_body, content_type, reg_token)

        result["message"] = f"Retagged {version} → latest"

    except requests.HTTPError as exc:
        result["status"] = "error"
        result["message"] = f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
    except Exception as exc:  # noqa: BLE001
        result["status"] = "error"
        result["message"] = str(exc)

    return result


def run(
        version: str,
        username: str,
        password: str,
        dry_run: bool,
        include: Optional[list[str]],
        exclude: Optional[list[str]],
) -> None:
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Re-tagging opencti connectors: {version} → latest\n")

    # Authenticate to Docker Hub
    print("⏳  Authenticating to Docker Hub …")
    hub_token = hub_login(username, password)

    # Discover all connector repos
    print("⏳  Listing connector repositories …")
    all_repos = list_connector_repos(hub_token)

    # Apply include / exclude filters
    if include:
        all_repos = [r for r in all_repos if r in include]
    if exclude:
        all_repos = [r for r in all_repos if r not in exclude]

    print(f"✅  Found {len(all_repos)} connector repo(s) to process\n")

    # Process in parallel
    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(retag_connector, repo, version, username, password, dry_run): repo
            for repo in all_repos
        }
        for future in as_completed(futures):
            res = future.result()
            results.append(res)
            icon = {"ok": "✅", "skipped": "⏭️ ", "dry-run": "🔍", "error": "❌"}.get(res["status"], "❓")
            print(f"  {icon}  {res['repo']:<55}  {res['message']}")

    # Summary
    counts = {"ok": 0, "skipped": 0, "dry-run": 0, "error": 0}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    print(f"\n{'─'*70}")
    print(f"  Total : {len(results)}")
    print(f"  ✅  Retagged : {counts['ok']}")
    print(f"  ⏭️   Skipped  : {counts['skipped']}  (tag '{version}' absent)")
    print(f"  🔍  Dry-run  : {counts['dry-run']}")
    print(f"  ❌  Errors   : {counts['error']}")

    if counts["error"]:
        print("\nFailed repos:")
        for r in results:
            if r["status"] == "error":
                print(f"  • {r['repo']}: {r['message']}")
        sys.exit(1)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Re-tag all opencti/connector-* Docker images: <version> → latest",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--version", "-v",
        required=True,
        help="Already-published version tag to promote to latest (e.g. 7.260309.0)",
    )
    parser.add_argument(
        "--username", "-u",
        default=os.environ.get("DOCKER_USERNAME"),
        help="Docker Hub username (or set DOCKER_USERNAME env var)",
    )
    parser.add_argument(
        "--password", "-p",
        default=os.environ.get("DOCKER_PASSWORD"),
        help="Docker Hub password / PAT (or set DOCKER_PASSWORD env var)",
    )
    parser.add_argument(
        "--password-stdin",
        action="store_true",
        help="Read password from stdin (safer than --password)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List what would be done without making any changes",
    )
    parser.add_argument(
        "--include",
        nargs="+",
        metavar="REPO",
        help="Only process these connector names (e.g. connector-misp connector-cve)",
    )
    parser.add_argument(
        "--exclude",
        nargs="+",
        metavar="REPO",
        help="Skip these connector names",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=MAX_WORKERS,
        help=f"Parallel workers (default: {MAX_WORKERS})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    username = args.username
    if not username:
        username = input("Docker Hub username: ").strip()

    password = args.password
    if args.password_stdin:
        password = sys.stdin.readline().rstrip("\n")
    if not password:
        password = getpass.getpass("Docker Hub password / PAT: ")

    global MAX_WORKERS
    MAX_WORKERS = args.workers

    run(
        version=args.version,
        username=username,
        password=password,
        dry_run=args.dry_run,
        include=args.include,
        exclude=args.exclude,
    )


if __name__ == "__main__":
    main()
