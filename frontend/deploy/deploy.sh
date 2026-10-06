#!/usr/bin/env bash
# Builds the web app and publishes it to the S3 bucket behind CloudFront, then clears the CloudFront cache.
# Usage: ./deploy/deploy.sh <bucket> <distribution-id> [aws-profile]
set -euo pipefail

BUCKET="${1:?usage: deploy.sh <bucket> <distribution-id> [aws-profile]}"
DISTRIBUTION_ID="${2:?usage: deploy.sh <bucket> <distribution-id> [aws-profile]}"
PROFILE="${3:-sentinel}"

cd "$(dirname "$0")/.."

if [ ! -f .env.production.local ]; then
  echo "warning: .env.production.local not found - building in demo mode (no Cognito, mock data)" >&2
fi

npm run build

# Hashed assets never change, so browsers may cache them for a year; pages must always revalidate.
aws s3 sync out/_next/static "s3://$BUCKET/_next/static" --cache-control "public,max-age=31536000,immutable" --profile "$PROFILE"
aws s3 sync out "s3://$BUCKET" --delete --exclude "_next/static/*" --cache-control "no-cache" --profile "$PROFILE"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" --profile "$PROFILE" --query "Invalidation.Id" --output text

echo "Done. Changes are live in 1-2 minutes."
