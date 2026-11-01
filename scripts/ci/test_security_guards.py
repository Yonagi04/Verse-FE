"""Check security false-green cases without Docker or network credentials."""

import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import build_image
import check_sarif


class SecurityGateTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)

    def test_high_findings_block_even_when_report_level_is_warning(self):
        for score in ("7.0", "9.8", "nan"):
            with self.subTest(score=score):
                report = {"version": "2.1.0", "runs": [{"tool": {"driver": {
                    "name": "CodeQL", "rules": [{"id": "security", "properties": {"security-severity": score}}]}},
                    "results": [{"ruleId": "security", "level": "warning"}]}]}
                path = self.root / "report.sarif"
                path.write_text(json.dumps(report), encoding="utf-8")
                with self.assertRaises(ValueError):
                    check_sarif.check(path)

    def test_analysis_error_missing_inventory_and_unscored_error_block(self):
        driver = {"name": "CodeQL", "rules": [{"id": "error"}]}
        for run in ({}, {"tool": {"driver": driver}, "invocations": [{"executionSuccessful": False}]},
                    {"tool": {"driver": driver}, "results": [{"ruleId": "error", "level": "error"}]}):
            path = self.root / "report.sarif"
            path.write_text(json.dumps({"version": "2.1.0", "runs": [run]}), encoding="utf-8")
            with self.assertRaises(ValueError):
                check_sarif.check(path)
        with self.assertRaises(OSError):
            check_sarif.check(self.root / "missing.sarif")

    def test_successful_analysis_without_findings_passes(self):
        path = self.root / "report.sarif"
        path.write_text(json.dumps({"version": "2.1.0", "runs": [{"tool": {"driver": {
            "name": "CodeQL", "rules": [{"id": "rule"}]}}, "results": [],
            "invocations": [{"executionSuccessful": True}]}]}), encoding="utf-8")
        check_sarif.check(path)

    def test_image_build_rejects_personal_configuration_and_geoip(self):
        target = self.root / "target"
        target.mkdir()
        for asset in ("BOOT-INF/classes/application-dev.yml", "BOOT-INF/classes/geoip/local.mmdb"):
            with self.subTest(asset=asset):
                with zipfile.ZipFile(target / "app.jar", "w") as jar:
                    jar.writestr(asset, "local-only")
                with patch.object(build_image, "ROOT", self.root), self.assertRaisesRegex(ValueError, "Refusing"):
                    build_image.application_jar()


if __name__ == "__main__":
    unittest.main()
