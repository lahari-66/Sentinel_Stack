"""Core stack: KMS key, DynamoDB single table, snapshot bucket, Cognito user pool."""

from __future__ import annotations

import aws_cdk as cdk
from aws_cdk import aws_cognito as cognito
from aws_cdk import aws_dynamodb as ddb
from aws_cdk import aws_kms as kms
from aws_cdk import aws_s3 as s3
from constructs import Construct


class CoreStack(cdk.Stack):
    def __init__(self, scope: Construct, id: str, *, stage: str, web_domain: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)
        prod = stage == "prod"
        removal = cdk.RemovalPolicy.RETAIN if prod else cdk.RemovalPolicy.DESTROY

        self.key = kms.Key(
            self,
            "DataKey",
            alias=f"alias/sentinelstack-{stage}",
            description="SentinelStack data: table, snapshots, External IDs",
            enable_key_rotation=True,
            removal_policy=removal,
        )

        self.table = ddb.TableV2(
            self,
            "Table",
            table_name=f"sentinelstack-{stage}",
            partition_key=ddb.Attribute(name="PK", type=ddb.AttributeType.STRING),
            sort_key=ddb.Attribute(name="SK", type=ddb.AttributeType.STRING),
            billing=ddb.Billing.on_demand(),
            encryption=ddb.TableEncryptionV2.customer_managed_key(self.key),
            point_in_time_recovery_specification=ddb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True
            ),
            removal_policy=removal,
            global_secondary_indexes=[
                ddb.GlobalSecondaryIndexPropsV2(
                    index_name="GSI1",  # findings queue: ACCT#<id>#STATUS#<s> / SEVERITY#<rank>-<sev>#<ruleId>
                    partition_key=ddb.Attribute(name="GSI1PK", type=ddb.AttributeType.STRING),
                    sort_key=ddb.Attribute(name="GSI1SK", type=ddb.AttributeType.STRING),
                ),
                ddb.GlobalSecondaryIndexPropsV2(
                    index_name="GSI3",  # RULE#<ruleId> / ACCT#<id>
                    partition_key=ddb.Attribute(name="GSI3PK", type=ddb.AttributeType.STRING),
                    sort_key=ddb.Attribute(name="GSI3SK", type=ddb.AttributeType.STRING),
                    projection_type=ddb.ProjectionType.KEYS_ONLY,
                ),
            ],
        )

        self.snapshots = s3.Bucket(
            self,
            "Snapshots",
            encryption=s3.BucketEncryption.KMS,
            encryption_key=self.key,
            bucket_key_enabled=True,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            versioned=True,
            lifecycle_rules=[
                s3.LifecycleRule(
                    expiration=cdk.Duration.days(90),
                    noncurrent_version_expiration=cdk.Duration.days(7),
                )
            ],
            removal_policy=removal,
            auto_delete_objects=not prod,
        )

        self.user_pool = cognito.UserPool(
            self,
            "Users",
            user_pool_name=f"sentinelstack-{stage}",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True)
            ),
            custom_attributes={"org_id": cognito.StringAttribute(min_len=1, max_len=64, mutable=True)},
            password_policy=cognito.PasswordPolicy(min_length=12, require_symbols=True),
            mfa=cognito.Mfa.OPTIONAL,
            mfa_second_factor=cognito.MfaSecondFactor(otp=True, sms=False),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            removal_policy=removal,
        )
        for group in ("admin", "viewer"):
            cognito.CfnUserPoolGroup(
                self,
                f"Group-{group}",
                user_pool_id=self.user_pool.user_pool_id,
                group_name=group,
            )

        callback_urls = [
            f"https://{web_domain}/auth/callback/",
            "http://localhost:3000/auth/callback/",
        ]
        logout_urls = [f"https://{web_domain}/login/", "http://localhost:3000/login/"]
        self.client = self.user_pool.add_client(
            "WebClient",
            generate_secret=False,
            auth_flows=cognito.AuthFlow(user_srp=True),
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(authorization_code_grant=True),
                scopes=[
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.PROFILE,
                ],
                callback_urls=callback_urls,
                logout_urls=logout_urls,
            ),
            # users may read org_id but never set it — only the backend assigns organisations
            read_attributes=cognito.ClientAttributes()
            .with_standard_attributes(email=True, email_verified=True)
            .with_custom_attributes("org_id"),
            write_attributes=cognito.ClientAttributes().with_standard_attributes(email=True),
            id_token_validity=cdk.Duration.hours(1),
            access_token_validity=cdk.Duration.hours(1),
            refresh_token_validity=cdk.Duration.days(7),
            prevent_user_existence_errors=True,
        )
        self.domain = self.user_pool.add_domain(
            "Domain",
            # hosted-UI prefix must be unique in the region; override with -c cognito_prefix=...
            cognito_domain=cognito.CognitoDomainOptions(
                domain_prefix=self.node.try_get_context("cognito_prefix") or f"sentinelstack-{stage}-team8"
            ),
        )

        cdk.CfnOutput(self, "TableName", value=self.table.table_name)
        cdk.CfnOutput(self, "SnapshotBucket", value=self.snapshots.bucket_name)
        cdk.CfnOutput(self, "UserPoolId", value=self.user_pool.user_pool_id)
        cdk.CfnOutput(self, "UserPoolClientId", value=self.client.user_pool_client_id)
        cdk.CfnOutput(
            self,
            "CognitoDomain",
            value=f"{self.domain.domain_name}.auth.{self.region}.amazoncognito.com",
        )
