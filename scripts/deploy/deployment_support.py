"""Release validation and SQLite snapshots; never restores business data."""

import hashlib
import json
import re
import sqlite3
from pathlib import Path


def load_manifest(bundle):
    manifest = json.loads((bundle / "release.json").read_text(encoding="utf-8"))
    version = manifest.get("version", "")
    if not re.fullmatch(r"wedding-\d{8}-\d{6}-[a-f0-9]{8}", version):
        raise ValueError("Invalid release version")
    if manifest.get("image") != "wedding-management:" + version:
        raise ValueError("Image tag does not match release version")
    if manifest.get("platform") != "linux/amd64":
        raise ValueError("Only linux/amd64 is supported")
    if manifest.get("archive") != "image.tar":
        raise ValueError("Expected image.tar inside release folder")
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", manifest.get("imageId", "")):
        raise ValueError("Invalid Docker image ID")
    if not re.fullmatch(r"[a-f0-9]{64}", manifest.get("sha256", "")):
        raise ValueError("Invalid archive checksum")
    with (bundle / "image.tar").open("rb") as stream:
        actual = hashlib.file_digest(stream, "sha256").hexdigest()
    if actual != manifest["sha256"]:
        raise ValueError("Image archive checksum mismatch; upload again")
    return manifest


def read_database(path):
    return sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True, timeout=30)


def migration_fingerprint(path):
    connection = read_database(path)
    try:
        schema = connection.execute(
            "SELECT name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name"
        ).fetchall()
        migrations = []
        if any(name == "__drizzle_migrations" for name, _ in schema):
            migrations = connection.execute(
                "SELECT * FROM __drizzle_migrations ORDER BY id"
            ).fetchall()
        return hashlib.sha256(json.dumps([schema, migrations]).encode()).hexdigest()
    finally:
        connection.close()


def backup_database(source, target):
    # SQLite backup includes committed WAL contents; plain file copying does not.
    with Path(target).open("xb"):
        pass
    source_connection = read_database(source)
    destination = sqlite3.connect(target)
    try:
        source_connection.backup(destination)
        if destination.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise RuntimeError("Backup integrity check failed")
    finally:
        destination.close()
        source_connection.close()


def write_atomic(path, content):
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(content, encoding="utf-8")
    temporary.replace(path)
