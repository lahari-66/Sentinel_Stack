"""Site stack: upload the Next.js static export, then invalidate CloudFront.

The frontend reads its API URL and Cognito settings from NEXT_PUBLIC_* variables at build time, so
deploy.yml deploys core/api/web first, builds the frontend from their outputs, then deploys this stack.
"""

from __future__ import annotations

from pathlib import Path

import aws_cdk as cdk
from aws_cdk import aws_s3_deployment as s3deploy
from constructs import Construct

from stacks.web import WebStack

FRONTEND_OUT = Path(__file__).resolve().parents[2] / "frontend" / "out"


class SiteStack(cdk.Stack):
    def __init__(self, scope: Construct, id: str, *, web: WebStack, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        s3deploy.BucketDeployment(
            self,
            "Deploy",
            sources=[s3deploy.Source.asset(str(FRONTEND_OUT))],
            destination_bucket=web.bucket,
            distribution=web.distribution,
            distribution_paths=["/*"],
            prune=True,
            memory_limit=512,
        )

    @staticmethod
    def frontend_built() -> bool:
        return (FRONTEND_OUT / "index.html").exists()
