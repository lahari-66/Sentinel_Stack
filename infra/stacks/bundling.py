"""Package backend/ for Lambda: pip-install Linux wheels locally, fall back to Docker."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import aws_cdk as cdk
import jsii
from aws_cdk import aws_lambda as lambda_

BACKEND = Path(__file__).resolve().parents[2] / "backend"
PACKAGES = ("app", "scanner", "services")


@jsii.implements(cdk.ILocalBundling)
class _LocalPip:
    def try_bundle(self, output_dir: str, *, image=None, **_) -> bool:
        try:
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "pip",
                    "install",
                    "-q",
                    "-r",
                    str(BACKEND / "requirements.txt"),
                    "-t",
                    output_dir,
                    "--platform",
                    "manylinux2014_x86_64",
                    "--implementation",
                    "cp",
                    "--python-version",
                    "3.12",
                    "--only-binary=:all:",
                    "--upgrade",
                ],
                check=True,
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False
        for pkg in PACKAGES:
            shutil.copytree(
                BACKEND / pkg,
                Path(output_dir) / pkg,
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
                dirs_exist_ok=True,
            )
        return True


def backend_code() -> lambda_.Code:
    return lambda_.Code.from_asset(
        str(BACKEND),
        exclude=[
            ".venv",
            "tests",
            "**/__pycache__",
            ".pytest_cache",
            ".ruff_cache",
            ".coverage",
        ],
        bundling=cdk.BundlingOptions(
            image=lambda_.Runtime.PYTHON_3_12.bundling_image,
            local=_LocalPip(),
            command=[
                "bash",
                "-c",
                "pip install -r requirements.txt -t /asset-output && cp -r app scanner services /asset-output",
            ],
        ),
    )
