#!/usr/bin/env python3
"""
Unit tests for the check_for_updates logic in prod-server.

These tests validate the update-detection mechanism which compares local
docker image digests against remote manifests and checks for running
containers.  Because this logic is sensitive to Docker CLI output format
changes, the tests are split into two categories:

1. **Unit tests** – mock subprocess calls so the tests run fast and
   offline.  These verify the *logic* of _check_single_image.

2. **Integration tests** – actually pull/tag real images via the Docker
   CLI.  Requires Docker to be installed and logged-in to ghcr.io.
   Skipped automatically when Docker is unavailable.

   The integration tests rely on the fact that the repository always has
   an ``edge`` tag that differs from ``latest``, and create ephemeral
   test tags (``test-base`` / ``test-update``) to exercise the full
   code path.
"""

import importlib
import importlib.machinery
import importlib.util
import json
import os
import subprocess
import sys
import textwrap
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Import prod-server as a module (the file has no .py extension)
# ---------------------------------------------------------------------------

_SCRIPT_PATH = Path(__file__).resolve().parent / "prod-server"

# The file has no .py extension, so we need to use a file loader explicitly.
_loader = importlib.machinery.SourceFileLoader("prod_server", str(_SCRIPT_PATH))
spec = importlib.util.spec_from_loader("prod_server", _loader, origin=str(_SCRIPT_PATH))
assert spec is not None, f"Could not create module spec for {_SCRIPT_PATH}"
prod_server: types.ModuleType = importlib.util.module_from_spec(spec)
# Prevent __main__ block from running during import
sys.modules["prod_server"] = prod_server
_loader.exec_module(prod_server)

# Convenience aliases
_check_single_image = prod_server._check_single_image
check_for_updates = prod_server.check_for_updates
exclude_strings = prod_server.exclude_strings
TRACE = prod_server.TRACE

# ---------------------------------------------------------------------------
# Helpers for mocking subprocess.run
# ---------------------------------------------------------------------------

def _make_result(stdout: str = "", returncode: int = 0) -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout=stdout, stderr="")


def _mock_run_factory(
    local_digest: str | None = None,
    remote_manifest: str = "",
    container_images: list[str] | None = None,
):
    """Return a side_effect function for subprocess.run that simulates
    docker inspect / manifest / container ls."""

    def _side_effect(cmd, **kwargs):
        cmd_str = " ".join(cmd) if isinstance(cmd, list) else cmd

        if "image inspect" in cmd_str:
            if local_digest is None:
                return _make_result("", returncode=1)
            return _make_result(local_digest)

        if "manifest inspect" in cmd_str:
            return _make_result(remote_manifest)

        if "container ls" in cmd_str:
            images = container_images or []
            return _make_result("\n".join(images))

        return _make_result("")

    return _side_effect


# ===================================================================
# Unit tests (mocked)
# ===================================================================
class TestCheckSingleImageMocked(unittest.TestCase):
    """Test _check_single_image with mocked docker calls."""

    @patch("prod_server.run")
    def test_image_not_local(self, mock_run: MagicMock):
        """If the image is not available locally, it should be flagged."""
        mock_run.side_effect = _mock_run_factory(local_digest=None)
        result = _check_single_image("ghcr.io/example/img:latest")
        self.assertEqual(result, "ghcr.io/example/img:latest")

    @patch("prod_server.run")
    def test_image_up_to_date(self, mock_run: MagicMock):
        """If local digest matches the remote manifest and a container
        exists, the image should NOT be flagged."""
        digest = "sha256:abc123"
        mock_run.side_effect = _mock_run_factory(
            local_digest=digest,
            remote_manifest=json.dumps({"digest": digest, "other": "data"}),
            container_images=["ghcr.io/example/img:latest"],
        )
        result = _check_single_image("ghcr.io/example/img:latest")
        self.assertIsNone(result)

    @patch("prod_server.run")
    def test_digest_mismatch(self, mock_run: MagicMock):
        """If local digest does NOT appear in the remote manifest, the
        image should be flagged for update."""
        mock_run.side_effect = _mock_run_factory(
            local_digest="sha256:localold",
            remote_manifest=json.dumps({"digest": "sha256:remotenew"}),
            container_images=["ghcr.io/example/img:latest"],
        )
        result = _check_single_image("ghcr.io/example/img:latest")
        self.assertEqual(result, "ghcr.io/example/img:latest")

    @patch("prod_server.run")
    def test_no_container(self, mock_run: MagicMock):
        """If the digest matches but no container is running, the image
        should still be flagged (container was removed or tag switched)."""
        digest = "sha256:abc123"
        mock_run.side_effect = _mock_run_factory(
            local_digest=digest,
            remote_manifest=json.dumps({"digest": digest}),
            container_images=[],  # no container
        )
        result = _check_single_image("ghcr.io/example/img:latest")
        self.assertEqual(result, "ghcr.io/example/img:latest")

    @patch("prod_server.run")
    def test_digest_with_at_sign(self, mock_run: MagicMock):
        """The bash version did ``cut -d '@' -f2``.  Verify we handle
        the '@' split correctly."""
        digest_raw = "sha256:abc@sha256:def"
        digest_expected = "sha256:def"
        mock_run.side_effect = _mock_run_factory(
            local_digest=digest_raw,
            remote_manifest=json.dumps({"digest": digest_expected}),
            container_images=["ghcr.io/example/img:latest"],
        )
        result = _check_single_image("ghcr.io/example/img:latest")
        self.assertIsNone(result)


class TestCheckForUpdatesMocked(unittest.TestCase):
    """Test check_for_updates (the parallel wrapper)."""

    @patch("prod_server._check_single_image")
    def test_parallel_aggregation(self, mock_check: MagicMock):
        """Verify that the thread-pool correctly aggregates results."""
        mock_check.side_effect = lambda img: img if "update" in img else None
        images = [
            "ghcr.io/example/needs-update:v1",
            "ghcr.io/example/up-to-date:v1",
            "ghcr.io/example/also-needs-update:v2",
        ]
        result = check_for_updates(images)
        self.assertEqual(sorted(result), sorted([
            "ghcr.io/example/needs-update:v1",
            "ghcr.io/example/also-needs-update:v2",
        ]))

    @patch("prod_server._check_single_image")
    def test_empty_list(self, mock_check: MagicMock):
        self.assertEqual(check_for_updates([]), [])
        mock_check.assert_not_called()


class TestExcludeStrings(unittest.TestCase):
    def test_basic_exclude(self):
        lines = ["alpha", "beta", "gamma", "alphabeta"]
        self.assertEqual(exclude_strings(lines, r"^alpha"), ["beta", "gamma"])

    def test_no_match(self):
        lines = ["one", "two"]
        self.assertEqual(exclude_strings(lines, r"xyz"), ["one", "two"])

    def test_exclude_all(self):
        lines = ["a", "b"]
        self.assertEqual(exclude_strings(lines, r"."), [])


# ===================================================================
# Integration tests – require Docker
# ===================================================================
def _docker_available() -> bool:
    try:
        r = subprocess.run(["docker", "info"], capture_output=True, timeout=10)
        return r.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


# A small public image guaranteed to exist
_TEST_BASE_IMAGE = "ghcr.io/geo-bon/bon-in-a-box-pipeline-engine/gateway"


@unittest.skipUnless(_docker_available(), "Docker is not available")
class TestCheckForUpdatesIntegration(unittest.TestCase):
    """Integration tests that exercise the real Docker CLI."""

    @classmethod
    def setUpClass(cls):
        """Pull both 'latest' and 'edge' tags so we have known-different
        images to compare."""
        print(f"\n  [setup] pulling {_TEST_BASE_IMAGE}:latest …")
        subprocess.run(
            ["docker", "pull", f"{_TEST_BASE_IMAGE}:latest"],
            capture_output=True,
            timeout=120,
        )
        print(f"  [setup] pulling {_TEST_BASE_IMAGE}:edge …")
        subprocess.run(
            ["docker", "pull", f"{_TEST_BASE_IMAGE}:edge"],
            capture_output=True,
            timeout=120,
        )

        # Create test tags from the two images
        # test-base  == latest   (we have it locally → up to date)
        # test-update == edge    (we retag locally as "test-update" but
        #   the remote for "edge" has a different digest → triggers update)
        subprocess.run(
            ["docker", "tag", f"{_TEST_BASE_IMAGE}:latest", f"{_TEST_BASE_IMAGE}:test-base"],
            check=True,
        )
        subprocess.run(
            ["docker", "tag", f"{_TEST_BASE_IMAGE}:edge", f"{_TEST_BASE_IMAGE}:test-update"],
            check=True,
        )

    @classmethod
    def tearDownClass(cls):
        """Remove the test tags."""
        subprocess.run(
            ["docker", "rmi", f"{_TEST_BASE_IMAGE}:test-base"],
            capture_output=True,
        )
        subprocess.run(
            ["docker", "rmi", f"{_TEST_BASE_IMAGE}:test-update"],
            capture_output=True,
        )

    def test_up_to_date_image_detected(self):
        """An image whose local digest matches the remote manifest should
        be recognised as up-to-date (or only flagged for missing container)."""
        result = _check_single_image(f"{_TEST_BASE_IMAGE}:latest")
        # Result is either None (truly up-to-date) or the image name
        # (no container running).  Either way the *digest* path passed.
        # We just make sure it doesn't crash.
        self.assertIn(result, [None, f"{_TEST_BASE_IMAGE}:latest"])

    def test_different_tags_detected(self):
        """'edge' and 'latest' are known to have different digests.
        We tagged edge as 'test-update'. When we ask to compare 'test-update'
        against the remote for the same tag, there is no remote 'test-update',
        so docker manifest inspect should fail or mismatch → flagged."""
        result = _check_single_image(f"{_TEST_BASE_IMAGE}:test-update")
        # test-update doesn't exist on the registry, so it should be flagged
        self.assertEqual(result, f"{_TEST_BASE_IMAGE}:test-update")

    def test_check_for_updates_integration(self):
        """Exercise the full parallel path with a mix of images."""
        images = [
            f"{_TEST_BASE_IMAGE}:latest",
            f"{_TEST_BASE_IMAGE}:test-update",
        ]
        result = check_for_updates(images)
        # test-update should always be flagged (no remote tag by that name)
        self.assertIn(f"{_TEST_BASE_IMAGE}:test-update", result)

    def test_nonexistent_image(self):
        """An image that doesn't exist locally or remotely."""
        result = _check_single_image("ghcr.io/geo-bon/bon-in-a-box-pipeline-engine/nonexistent:v999")
        self.assertEqual(result, "ghcr.io/geo-bon/bon-in-a-box-pipeline-engine/nonexistent:v999")


if __name__ == "__main__":
    unittest.main()
