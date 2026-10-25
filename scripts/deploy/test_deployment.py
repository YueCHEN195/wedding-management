"""Run with python scripts/deploy/test_deployment.py; never contacts a server."""

import hashlib
from contextlib import contextmanager
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from deployment_support import backup_database, load_manifest, migration_fingerprint

spec = importlib.util.spec_from_file_location(
    "updater", Path(__file__).with_name("update-server.py")
)
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)
VERSION = "wedding-20261023-160000-aabbccdd"
NEW_IMAGE = "sha256:" + "a" * 64
OLD_IMAGE = "sha256:" + "b" * 64


@contextmanager
def database(path):
    connection = sqlite3.connect(path)
    try:
        with connection:
            yield connection
    finally:
        connection.close()


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.project = self.root / "project"
        (self.project / "data").mkdir(parents=True)
        self.db = self.project / "data/wedding.db"
        with database(self.db) as connection:
            connection.execute("CREATE TABLE notes (text TEXT)")
            connection.execute("INSERT INTO notes VALUES ('retained data')")
        self.bundle = self.root / "bundle"
        self.bundle.mkdir()
        payload = b"fake Docker archive"
        (self.bundle / "image.tar").write_bytes(payload)
        self.manifest = {
            "version": VERSION, "image": "wedding-management:" + VERSION,
            "imageId": NEW_IMAGE, "archive": "image.tar", "platform": "linux/amd64",
            "sha256": hashlib.sha256(payload).hexdigest(),
        }
        self.save_manifest()

    def save_manifest(self):
        (self.bundle / "release.json").write_text(json.dumps(self.manifest))

    def patch(self, target, name, **kwargs):
        patcher = patch.object(target, name, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

    def mocked_deployment(self):
        deployment = updater.Deployment(self.project)
        self.patch(deployment, "preflight", return_value=OLD_IMAGE)
        self.patch(deployment, "compose", return_value="")
        self.patch(deployment, "run", return_value=json.dumps([{
            "Id": NEW_IMAGE, "Os": "linux", "Architecture": "amd64",
        }]))
        self.patch(deployment, "start")
        return deployment

    def test_archive_corruption_is_rejected(self):
        (self.bundle / "image.tar").write_bytes(b"truncated upload")
        with self.assertRaisesRegex(ValueError, "checksum"):
            load_manifest(self.bundle)

    def test_manifest_rejects_paths_tags_and_platforms(self):
        for key, value in [("archive", "../image.tar"), ("image", "other:latest"),
                           ("platform", "linux/arm64"), ("version", "../x")]:
            with self.subTest(key=key):
                original = self.manifest[key]
                self.manifest[key] = value
                self.save_manifest()
                with self.assertRaises(ValueError):
                    load_manifest(self.bundle)
                self.manifest[key] = original

    def test_consistent_backup_contains_committed_wal_rows(self):
        connection = sqlite3.connect(self.db)
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA wal_autocheckpoint=0")
        connection.execute("INSERT INTO notes VALUES ('committed WAL row')")
        connection.commit()
        try:
            target = self.root / "backup.db"
            backup_database(self.db, target)
            with database(target) as snapshot:
                self.assertEqual(snapshot.execute("SELECT count(*) FROM notes").fetchone()[0], 2)
            with self.assertRaises(FileExistsError):
                backup_database(self.db, target)
        finally:
            connection.close()

    def test_fingerprint_ignores_business_writes_but_detects_migrations(self):
        before = migration_fingerprint(self.db)
        with database(self.db) as connection:
            connection.execute("INSERT INTO notes VALUES ('new live data')")
        self.assertEqual(before, migration_fingerprint(self.db))
        with database(self.db) as connection:
            connection.execute("CREATE TABLE __drizzle_migrations (id INTEGER, hash TEXT)")
        after_schema = migration_fingerprint(self.db)
        self.assertNotEqual(before, after_schema)
        with database(self.db) as connection:
            connection.execute("INSERT INTO __drizzle_migrations VALUES (1, 'data-only-migration')")
        self.assertNotEqual(after_schema, migration_fingerprint(self.db))

    def test_success_retains_data_and_writes_receipt(self):
        deployment = self.mocked_deployment()
        self.patch(deployment, "healthy", return_value=True)
        deployment.update(self.bundle)
        receipt = json.loads((self.project / "deployment-state.json").read_text())
        self.assertEqual(receipt["previousImage"], OLD_IMAGE)
        self.assertTrue(Path(receipt["backup"]).exists())
        with database(self.db) as connection:
            self.assertEqual(connection.execute("SELECT text FROM notes").fetchone()[0], "retained data")

    def test_failed_health_recovers_image_without_reverting_live_writes(self):
        deployment = self.mocked_deployment()
        self.patch(deployment, "healthy", side_effect=[False, True])

        def write_after_start():
            with database(self.db) as connection:
                connection.execute("INSERT INTO notes VALUES ('write during health check')")

        deployment.start.side_effect = write_after_start
        with self.assertRaisesRegex(RuntimeError, "health"):
            deployment.update(self.bundle)
        self.assertIn(OLD_IMAGE, deployment.override.read_text())
        self.assertEqual(deployment.start.call_count, 2)
        with database(self.db) as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM notes").fetchone()[0], 3)

    def test_changed_migrations_stop_instead_of_restoring_database(self):
        deployment = self.mocked_deployment()
        self.patch(deployment, "healthy", return_value=False)

        def migrate():
            with database(self.db) as connection:
                connection.execute("ALTER TABLE notes ADD COLUMN added TEXT")

        deployment.start.side_effect = migrate
        with self.assertRaisesRegex(RuntimeError, "migrations changed"):
            deployment.update(self.bundle)
        self.assertEqual(deployment.start.call_count, 1)
        self.assertNotIn(OLD_IMAGE, deployment.override.read_text())
        with database(self.db) as connection:
            self.assertEqual(len(connection.execute("PRAGMA table_info(notes)").fetchall()), 2)

    def test_backup_failure_restarts_previous_image(self):
        deployment = self.mocked_deployment()
        self.patch(deployment, "healthy", return_value=True)
        with patch.object(updater, "backup_database", side_effect=OSError("disk error")):
            with self.assertRaisesRegex(OSError, "disk error"):
                deployment.update(self.bundle)
        self.assertIn(OLD_IMAGE, deployment.override.read_text())

    def test_load_failure_does_not_stop_current_app(self):
        deployment = self.mocked_deployment()
        deployment.run.side_effect = RuntimeError("load failed")
        with self.assertRaisesRegex(RuntimeError, "load failed"):
            deployment.update(self.bundle)
        deployment.compose.assert_not_called()
        deployment.start.assert_not_called()

    def test_wrong_mount_is_rejected(self):
        (self.project / ".env").write_text("example")
        deployment = updater.Deployment(self.project)
        self.patch(deployment, "compose", return_value="container-id")
        self.patch(deployment, "run", return_value=json.dumps([{
            "State": {"Running": True}, "Image": OLD_IMAGE,
            "Mounts": [{"Destination": "/data", "Source": str(self.root / "other-data")}],
        }]))
        with self.assertRaisesRegex(RuntimeError, "mount"):
            deployment.preflight()


if __name__ == "__main__":
    unittest.main()
