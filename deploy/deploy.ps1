<#
  Deploys SnowBall+ to S3 and invalidates CloudFront.
  Usage (PowerShell, from the project folder):
    .\deploy\deploy.ps1 -Bucket my-snowballplus-bucket -DistributionId E123ABCDEF456 [-Profile myprofile]
  Requires: AWS CLI v2, credentials with s3:PutObject/DeleteObject/ListBucket and cloudfront:CreateInvalidation.
#>
param(
  [Parameter(Mandatory = $true)][string]$Bucket,
  [Parameter(Mandatory = $true)][string]$DistributionId,
  [string]$Profile = "default"
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# 1) Static assets: cached for an hour (CloudFront is invalidated below, so changes appear quickly)
aws s3 sync "$root" "s3://$Bucket" --profile $Profile --delete `
  --exclude "*" --include "css/*" --include "js/*" `
  --cache-control "public,max-age=3600"

# 2) index.html: always revalidate so users pick up new asset versions
aws s3 cp "$root\index.html" "s3://$Bucket/index.html" --profile $Profile `
  --cache-control "no-cache" --content-type "text/html; charset=utf-8"

# 3) Clear the CloudFront cache
aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*" --profile $Profile
Write-Host "Deployed. Open your CloudFront URL and hard-refresh (Ctrl+F5) once." -ForegroundColor Green
