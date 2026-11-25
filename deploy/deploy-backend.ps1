<#
  Deploys the SnowBall+ data API (AWS SAM: HTTP API + Lambda) and points the website at it.
  Usage (PowerShell, from the project folder):
    .\deploy\deploy-backend.ps1 -SiteOrigin https://d1234abcd.cloudfront.net [-Region us-east-1] [-Profile default]
  You are prompted for each key; press Enter to skip any provider you do not use.
  Requires: AWS CLI v2 and the AWS SAM CLI (sam), credentials that can create CloudFormation/Lambda/API Gateway/IAM roles.
#>
param(
  [Parameter(Mandatory = $true)][string]$SiteOrigin,
  [string]$StackName = "snowballplus-api",
  [string]$Region = "us-east-1",
  [string]$Profile = "default"
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
function Ask($label) { $s = Read-Host $label -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }
$finnhub = Ask "Finnhub API key (stocks, ETFs, news)"
$twelve  = Ask "Twelve Data API key (price history; optional)"
$fred    = Ask "FRED API key (Treasury yields; optional)"
$openai  = Ask "OpenAI API key (Explain this move; optional)"

function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE). No website files were changed." } }

Push-Location "$root\backend"
try {
  sam build --region $Region --profile $Profile
  Check "sam build"
  sam deploy --stack-name $StackName --region $Region --profile $Profile --resolve-s3 --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset `
    --parameter-overrides "SiteOrigin=$SiteOrigin" "FinnhubKey=$finnhub" "TwelveKey=$twelve" "FredKey=$fred" "OpenAiKey=$openai"
  Check "sam deploy"
} finally { Pop-Location }

$api = aws cloudformation describe-stacks --stack-name $StackName --region $Region --profile $Profile --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
Check "Reading the API URL"
if (-not $api -or $api -notmatch '^https://') { throw "Could not read the API URL from the stack. No website files were changed." }
Write-Host "API URL: $api" -ForegroundColor Green

# Point the site at the API and allow it in the Content-Security-Policy.
# Write UTF-8 WITHOUT a byte-order mark (Windows PowerShell 5.1's Set-Content -Encoding utf8 adds one, which the AWS CLI rejects).
$utf8 = New-Object System.Text.UTF8Encoding($false)
$cfgPath = "$root\js\config.js"
$cfg = [IO.File]::ReadAllText($cfgPath)
$cfg = [regex]::Replace($cfg, '(window\.SB_CONFIG\s*=\s*\{\s*apiBase:\s*)(null|"[^"]*")', "`${1}`"$api`"")
[IO.File]::WriteAllText($cfgPath, $cfg.TrimStart([char]0xFEFF), $utf8)
$hPath = "$root\deploy\cloudfront-security-headers.json"
$h = [IO.File]::ReadAllText($hPath)
$h = [regex]::Replace($h, "connect-src 'self'[^;]*;", "connect-src 'self' $api;")
[IO.File]::WriteAllText($hPath, $h.TrimStart([char]0xFEFF), $utf8)
Write-Host "Updated js\config.js and deploy\cloudfront-security-headers.json." -ForegroundColor Green
Write-Host "Next: apply the headers policy to your CloudFront distribution (see README, 'Real market data'), then run .\deploy\deploy.ps1." -ForegroundColor Yellow
