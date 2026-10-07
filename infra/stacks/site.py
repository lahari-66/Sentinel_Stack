"""Site stack: upload the Next.js static export plus a runtime config.json, then invalidate CloudFront.

Kept separate from WebStack so it can depend on core/api outputs without a dependency cycle
(core needs the CloudFront domain for Cognito callback URLs).
"""

from __future__ import annotations

from pathlib import Path

import aws_cdk as cdk
from aws_cdk import aws_s3_deployment as s3deploy
from constructs import Construct

from stacks.api import ApiStack
from stacks.core import CoreStack
from stacks.web import WebStack

FRONTEND_OUT = Path(__file__).resolve().parents[2] / "frontend" / "out"


class SiteStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        web: WebStack,
        core: CoreStack,
        api: ApiStack,
        **kwargs,
    ) -> None:
        super().__init__(scope, id, **kwargs)

        config = {
            "apiUrl": api.api.api_endpoint,
            "cognitoDomain": f"https://{core.domain.domain_name}.auth.{core.region}.amazoncognito.com",
            "cognitoClientId": core.client.user_pool_client_id,
            "redirectUri": f"https://{web.domain_name}/auth/callback/",
            "logoutUri": f"https://{web.domain_name}/login/",
        }

        s3deploy.BucketDeployment(
            self,
            "Deploy",
            sources=[
                s3deploy.Source.asset(str(FRONTEND_OUT)),
                s3deploy.Source.json_data("config.json", config),
            ],
            destination_bucket=web.bucket,
            distribution=web.distribution,
            distribution_paths=["/*"],
            prune=True,
            memory_limit=512,
        )

    @staticmethod
    def frontend_built() -> bool:
        return (FRONTEND_OUT / "index.html").exists()
