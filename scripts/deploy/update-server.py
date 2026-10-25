#!/usr/bin/env python3
"""Update an existing deployment; invoke with sudo, never initializes accounts."""

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

from deployment_support import (
    backup_database,
    load_manifest,
    migration_fingerprint,
    write_atomic,
)

HEALTH_TIMEOUT_SECONDS = 60
HEALTH_INTERVAL_SECONDS = 2
BACKUP_SPACE_MARGIN_BYTES = 64 * 1024 * 1024
HEALTH_SCRIPT = """
const base = 'http://127.0.0.1:3000';
const options = () => ({ signal: AbortSignal.timeout(2500) });
const health = await fetch(base + '/api/health', options());
if (!health.ok || (await health.json()).data?.status !== 'ok') process.exit(1);
const page = await fetch(base + '/admin/login', options());
const denied = await fetch(base + '/api/guests', options());
if (page.status !== 200 || denied.status !== 401) process.exit(1);
"""


class Deployment:
    def __init__(self, project):
        self.project = project
        self.override = project / ".compose.release.yml"
        self.database = project / "data/wedding.db"
        self.files = [project / "docker-compose.yml"]
        staging = project / "compose.staging.yml"
        if staging.exists():
            self.files.append(staging)

    def run(self, arguments, *, capture=False, timeout=600):
        result = subprocess.run(
            arguments,
            cwd=self.project,
            check=True,
            text=True,
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.PIPE if capture else None,
            timeout=timeout,
        )
        return result.stdout.strip() if capture else ""

    def compose(self, *arguments, capture=False, timeout=600):
        command = ["docker", "compose", "--project-directory", str(self.project)]
        for path in self.files:
            command.extend(["-f", str(path)])
        if self.override.exists():
            command.extend(["-f", str(self.override)])
        return self.run(command + list(arguments), capture=capture, timeout=timeout)

    def set_image(self, image):
        write_atomic(
            self.override,
            "services:\n  app:\n    image: " + image + "\n    pull_policy: never\n",
        )

    def start(self):
        self.compose("up", "-d", "--no-build", "--no-deps", "app")

    def healthy(self):
        deadline = time.monotonic() + HEALTH_TIMEOUT_SECONDS
        while time.monotonic() < deadline:
            try:
                self.compose(
                    "exec", "-T", "app", "node", "--input-type=module", "-e",
                    HEALTH_SCRIPT, capture=True, timeout=10,
                )
                return True
            except (subprocess.SubprocessError, OSError):
                time.sleep(HEALTH_INTERVAL_SECONDS)
        return False

    def preflight(self):
        if not (self.project / ".env").is_file() or not self.database.is_file():
            raise RuntimeError("Existing .env and data/wedding.db are required; this is an updater")
        container = self.compose("ps", "-q", "app", capture=True)
        if not container or "\n" in container:
            raise RuntimeError("Expected exactly one running app container")
        state = json.loads(self.run(["docker", "inspect", container], capture=True))[0]
        if not state["State"]["Running"]:
            raise RuntimeError("Current app is not running")
        # Refuse unknown data locations instead of backing up an unrelated local DB.
        mounted = [m for m in state["Mounts"] if m["Destination"] == "/data"]
        if len(mounted) != 1 or Path(mounted[0]["Source"]).resolve() != self.database.parent.resolve():
            raise RuntimeError("App /data mount does not match project/data")
        if not self.healthy():
            raise RuntimeError("Current app is unhealthy; fix it before updating")
        return state["Image"]

    def recover(self, old_image, fingerprint, backup):
        self.compose("stop", "app")
        if migration_fingerprint(self.database) != fingerprint:
            raise RuntimeError(
                "Database migrations changed. App is stopped; no automatic database restore. "
                f"Keep current data and backup {backup}; inspect migrations before recovery. "
                f"Previous image: {old_image}"
            )
        self.set_image(old_image)
        self.start()
        if not self.healthy():
            raise RuntimeError("Previous image also failed health checks; manual investigation required")
        print("Previous image recovered. Current data was retained; no database restore performed.")

    def update(self, bundle):
        manifest = load_manifest(bundle)
        old_image = self.preflight()
        print("Loading image while current app remains available...", flush=True)
        self.run(["docker", "load", "-i", str(bundle / "image.tar")])
        loaded = json.loads(self.run(
            ["docker", "image", "inspect", manifest["image"]], capture=True
        ))[0]
        if (loaded["Id"] != manifest["imageId"] or loaded["Os"] != "linux"
                or loaded["Architecture"] != "amd64"):
            raise RuntimeError("Loaded image identity or platform mismatch")
        fingerprint = migration_fingerprint(self.database)
        backup_folder = self.project / "backups" / manifest["version"]
        backup_folder.mkdir(parents=True, mode=0o700)
        backup = backup_folder / "wedding.db"
        wal = Path(str(self.database) + "-wal")
        wal_size = wal.stat().st_size if wal.exists() else 0
        required = self.database.stat().st_size * 2 + wal_size
        if shutil.disk_usage(self.project).free < required + BACKUP_SPACE_MARGIN_BYTES:
            raise RuntimeError("Insufficient disk space for a consistent backup")
        write_atomic(backup_folder / "release.json", json.dumps({
            "previousImage": old_image, "nextImage": manifest["imageId"],
            "fingerprint": fingerprint,
        }, indent=2))
        print("Stopping app briefly, taking backup, then switching image...", flush=True)
        try:
            self.compose("stop", "app")
            backup_database(self.database, backup)
            self.set_image(manifest["image"])
            self.start()
            if not self.healthy():
                raise RuntimeError("New release failed health checks")
        except Exception:
            self.recover(old_image, fingerprint, backup)
            raise
        write_atomic(self.project / "deployment-state.json", json.dumps({
            **manifest, "previousImage": old_image, "backup": str(backup),
        }, indent=2))
        print(f"Updated successfully: {manifest['version']}\nBackup: {backup}")
        print("Accounts, .env, Caddy, ports and business data were preserved.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=Path("/home/ubuntu/wedding-management"))
    args = parser.parse_args()
    if sys.platform != "linux" or os.geteuid() != 0:
        raise RuntimeError("Run on the Linux server using sudo python3")
    import fcntl

    project = args.project.resolve(strict=True)
    os.umask(0o077)
    with (project / ".deployment.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError("Another deployment is already running") from error
        Deployment(project).update(Path(__file__).resolve().parent)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"UPDATE FAILED: {error}", file=sys.stderr)
        sys.exit(1)
