"""API stack: HTTP API with a Cognito JWT authorizer in front of the FastAPI Lambda."""

from __future__ import annotations

import aws_cdk as cdk
from aws_cdk import aws_apigatewayv2 as apigw
from aws_cdk import aws_apigatewayv2_authorizers as authorizers
from aws_cdk import aws_apigatewayv2_integrations as integrations
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_logs as logs
from constructs import Construct

from stacks.bundling import backend_code
from stacks.core import CoreStack


class ApiStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        stage: str,
        core: CoreStack,
        web_domain: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, id, **kwargs)

        self.fn = lambda_.Function(
            self,
            "ApiFn",
            runtime=lambda_.Runtime.PYTHON_3_12,
            architecture=lambda_.Architecture.X86_64,
            handler="app.main.handler",
            code=backend_code(),
            memory_size=512,
            timeout=cdk.Duration.seconds(15),
            environment={
                "STAGE": stage,
                "TABLE_NAME": core.table.table_name,
                "KMS_KEY_ID": core.key.key_arn,
            },
            log_group=logs.LogGroup(
                self,
                "ApiLogs",
                retention=logs.RetentionDays.ONE_MONTH,
                removal_policy=cdk.RemovalPolicy.DESTROY,
            ),
            tracing=lambda_.Tracing.ACTIVE,
        )
        core.table.grant_read_write_data(self.fn)
        core.key.grant_encrypt_decrypt(self.fn)

        issuer = f"https://cognito-idp.{self.region}.amazonaws.com/{core.user_pool.user_pool_id}"
        jwt = authorizers.HttpJwtAuthorizer("Cognito", issuer, jwt_audience=[core.client.user_pool_client_id])
        integration = integrations.HttpLambdaIntegration("Api", self.fn)

        self.api = apigw.HttpApi(
            self,
            "HttpApi",
            api_name=f"sentinelstack-{stage}",
            cors_preflight=apigw.CorsPreflightOptions(
                allow_origins=[f"https://{web_domain}", "http://localhost:3000"],
                allow_methods=[apigw.CorsHttpMethod.ANY],
                allow_headers=["authorization", "content-type"],
                max_age=cdk.Duration.hours(1),
            ),
            default_authorizer=jwt,
        )
        self.api.add_routes(
            path="/health",
            methods=[apigw.HttpMethod.GET],
            integration=integration,
            authorizer=apigw.HttpNoneAuthorizer(),
        )
        self.api.add_routes(
            path="/{proxy+}",
            methods=[
                apigw.HttpMethod.GET,
                apigw.HttpMethod.POST,
                apigw.HttpMethod.PUT,
                apigw.HttpMethod.DELETE,
            ],
            integration=integration,
        )

        stage_cfn = self.api.default_stage.node.default_child
        stage_cfn.default_route_settings = apigw.CfnStage.RouteSettingsProperty(
            throttling_burst_limit=50, throttling_rate_limit=20
        )

        cdk.CfnOutput(self, "ApiUrl", value=self.api.api_endpoint)
