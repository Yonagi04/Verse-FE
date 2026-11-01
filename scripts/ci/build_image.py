"""Build a local security-scan image; never authenticate, push or create releases."""

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]


def application_jar():
    jars = [path for path in (ROOT / "target").glob("*.jar") if path.name != "verse.jar"]
    if len(jars) != 1:
        raise ValueError("Expected one Maven application jar")
    with zipfile.ZipFile(jars[0]) as jar:
        if any(name.endswith("/application-dev.yml") or name.endswith(".mmdb") for name in jar.namelist()):
            raise ValueError("Refusing local development configuration or GeoIP assets in image")
    return jars[0]


def build(kind):
    images = json.loads((ROOT / "docker/images.json").read_text(encoding="utf-8"))
    base = images["java" if kind == "backend" else "nginx"]
    if not re.fullmatch(r"[a-z0-9./:_-]+@sha256:[0-9a-f]{64}", base):
        raise ValueError("Runtime image must be pinned by digest")
    if kind == "backend":
        shutil.copy2(application_jar(), ROOT / "target/verse.jar")
    elif not (ROOT / "dist/index.html").is_file():
        raise ValueError("Frontend build is missing")
    subprocess.run(["docker", "build", "--pull", "--platform", "linux/amd64",
                    "--build-arg", "RUNTIME_IMAGE=" + base, "-t", "verse-security:local", "."],
                   cwd=ROOT, check=True)
    info = json.loads(subprocess.check_output(
        ["docker", "image", "inspect", "verse-security:local"], cwd=ROOT, text=True))[0]
    if info["Config"].get("User", "").split(":")[0] in ("", "0", "root"):
        raise ValueError("Image must use a non-root runtime user")
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", info["Id"]):
        raise ValueError("Invalid local image ID")
    if output := os.environ.get("GITHUB_OUTPUT"):
        with open(output, "a", encoding="utf-8") as stream:
            stream.write("image_id=" + info["Id"] + "\n")
    print("Local image for scanning: " + info["Id"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=("frontend", "backend"))
    build(parser.parse_args().kind)
