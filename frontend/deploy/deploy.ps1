<#
.SYNOPSIS
  Builds the web app and publishes it to the S3 bucket behind CloudFront, then clears the CloudFront cache.

.DESCRIPTION
  Needs the AWS CLI configured with your own profile (aws configure --profile sentinel) and
  frontend/.env.production.local holding the Cognito and API values for the deployed site.

.EXAMPLE
  .\deploy\deploy.ps1 -Bucket sentinelstack-web-dev-123456789012 -DistributionId E1ABCDEF2GHIJK
#>
param(
  [Parameter(Mandatory = $true)][string]$Bucket,
  [Parameter(Mandatory = $true)][string]$DistributionId,
  [string]$Profile = "sentinel"
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env.production.local")) {
  Write-Warning ".env.production.local not found - the site will be built in demo mode (no Cognito, mock data)."
}

Write-Host "Building static export..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

Write-Host "Uploading hashed assets (cached for a year)..." -ForegroundColor Cyan
aws s3 sync "out/_next/static" "s3://$Bucket/_next/static" --cache-control "public,max-age=31536000,immutable" --profile $Profile
if ($LASTEXITCODE -ne 0) { throw "Upload of static assets failed." }

Write-Host "Uploading pages (always revalidated)..." -ForegroundColor Cyan
aws s3 sync "out" "s3://$Bucket" --delete --exclude "_next/static/*" --cache-control "no-cache" --profile $Profile
if ($LASTEXITCODE -ne 0) { throw "Upload of pages failed." }

Write-Host "Invalidating CloudFront cache..." -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --profile $Profile --query "Invalidation.Id" --output text
if ($LASTEXITCODE -ne 0) { throw "Invalidation failed." }

Write-Host "Done. Changes are live in 1-2 minutes." -ForegroundColor Green
