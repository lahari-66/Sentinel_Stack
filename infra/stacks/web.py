"""Web stack: private S3 bucket served by CloudFront through Origin Access Control."""

from __future__ import annotations

import aws_cdk as cdk
from aws_cdk import aws_cloudfront as cf
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_s3 as s3
from constructs import Construct

# Next.js static export writes /accounts/index.html; CloudFront needs the index appended.
INDEX_REWRITE = """
function handler(event) {
  var req = event.request;
  if (req.uri.endsWith('/')) { req.uri += 'index.html'; }
  else if (!req.uri.includes('.')) { req.uri += '/index.html'; }
  return req;
}
"""


class WebStack(cdk.Stack):
    def __init__(self, scope: Construct, id: str, *, stage: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)
        prod = stage == "prod"

        self.bucket = s3.Bucket(
            self,
            "Site",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            removal_policy=cdk.RemovalPolicy.RETAIN if prod else cdk.RemovalPolicy.DESTROY,
            auto_delete_objects=not prod,
        )

        rewrite = cf.Function(
            self,
            "IndexRewrite",
            code=cf.FunctionCode.from_inline(INDEX_REWRITE),
            runtime=cf.FunctionRuntime.JS_2_0,
        )

        self.distribution = cf.Distribution(
            self,
            "Cdn",
            default_root_object="index.html",
            default_behavior=cf.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(self.bucket),
                viewer_protocol_policy=cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                response_headers_policy=cf.ResponseHeadersPolicy.SECURITY_HEADERS,
                function_associations=[
                    cf.FunctionAssociation(function=rewrite, event_type=cf.FunctionEventType.VIEWER_REQUEST)
                ],
            ),
            error_responses=[
                cf.ErrorResponse(
                    http_status=404,
                    response_http_status=404,
                    response_page_path="/404.html",
                )
            ],
            minimum_protocol_version=cf.SecurityPolicyProtocol.TLS_V1_2_2021,
            price_class=cf.PriceClass.PRICE_CLASS_200,
        )
        self.domain_name = self.distribution.distribution_domain_name

        cdk.CfnOutput(self, "SiteBucket", value=self.bucket.bucket_name)
        cdk.CfnOutput(self, "DistributionId", value=self.distribution.distribution_id)
        cdk.CfnOutput(self, "SiteUrl", value=f"https://{self.domain_name}")
