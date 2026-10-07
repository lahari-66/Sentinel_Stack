"""Synthesise every stack and assert the security properties we promise."""

import aws_cdk as cdk
import pytest
from aws_cdk.assertions import Match, Template

from stacks.api import ApiStack
from stacks.core import CoreStack
from stacks.web import WebStack


@pytest.fixture(scope="module")
def templates():
    app = cdk.App(context={"aws:cdk:bundling-stacks": []})  # skip Lambda bundling in unit tests
    env = cdk.Environment(account="111111111111", region="ap-south-1")
    web = WebStack(app, "web", stage="dev", env=env)
    core = CoreStack(app, "core", stage="dev", web_domain=web.domain_name, env=env)
    api = ApiStack(app, "api", stage="dev", core=core, web_domain=web.domain_name, env=env)
    return {
        "web": Template.from_stack(web),
        "core": Template.from_stack(core),
        "api": Template.from_stack(api),
    }


def test_table_kms_and_pitr(templates):
    templates["core"].has_resource_properties(
        "AWS::DynamoDB::GlobalTable",
        {
            "SSESpecification": {"SSEEnabled": True, "SSEType": "KMS"},
            "Replicas": [Match.object_like({"PointInTimeRecoverySpecification": {"PointInTimeRecoveryEnabled": True}})],
            "GlobalSecondaryIndexes": Match.array_with([Match.object_like({"IndexName": "GSI1"})]),
        },
    )


def test_kms_rotation(templates):
    templates["core"].has_resource_properties("AWS::KMS::Key", {"EnableKeyRotation": True})


def test_snapshot_bucket_private_and_expiring(templates):
    templates["core"].has_resource_properties(
        "AWS::S3::Bucket",
        {
            "PublicAccessBlockConfiguration": {
                "BlockPublicAcls": True,
                "BlockPublicPolicy": True,
                "IgnorePublicAcls": True,
                "RestrictPublicBuckets": True,
            },
            "LifecycleConfiguration": {"Rules": Match.array_with([Match.object_like({"ExpirationInDays": 90})])},
        },
    )


def test_cognito_groups(templates):
    templates["core"].resource_count_is("AWS::Cognito::UserPoolGroup", 2)


def test_every_route_but_health_is_authorised(templates):
    routes = templates["api"].find_resources("AWS::ApiGatewayV2::Route")
    assert routes
    for route in routes.values():
        props = route["Properties"]
        if props["RouteKey"] == "GET /health":
            assert props.get("AuthorizationType", "NONE") == "NONE"
        elif not props["RouteKey"].startswith("OPTIONS"):
            assert props["AuthorizationType"] == "JWT", props["RouteKey"]


def test_site_served_via_oac(templates):
    templates["web"].resource_count_is("AWS::CloudFront::OriginAccessControl", 1)
