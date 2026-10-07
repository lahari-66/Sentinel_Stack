#!/usr/bin/env python3
"""SentinelStack CDK app.  cdk deploy -c stage=dev --all"""

import os

import aws_cdk as cdk

from stacks.api import ApiStack
from stacks.core import CoreStack
from stacks.site import SiteStack
from stacks.web import WebStack

app = cdk.App()
stage = app.node.try_get_context("stage") or "dev"
env = cdk.Environment(
    account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
    region=app.node.try_get_context("platform_region") or "ap-south-1",
)

web = WebStack(app, f"sentinel-web-{stage}", stage=stage, env=env)
core = CoreStack(app, f"sentinel-core-{stage}", stage=stage, web_domain=web.domain_name, env=env)
ApiStack(
    app,
    f"sentinel-api-{stage}",
    stage=stage,
    core=core,
    web_domain=web.domain_name,
    env=env,
)
if SiteStack.frontend_built():  # build frontend/ with the core/api/web outputs first (see deploy.yml)
    SiteStack(app, f"sentinel-site-{stage}", web=web, env=env)

cdk.Tags.of(app).add("project", "sentinelstack")
cdk.Tags.of(app).add("stage", stage)
app.synth()
