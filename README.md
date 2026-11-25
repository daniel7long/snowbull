# SnowBall+ — investing simulator

A static web app (HTML + CSS + vanilla JavaScript, **no build step**) for practicing portfolio building,
trading stocks / ETFs / mutual funds / bonds, and following finance news.
Money, accounts and orders are fictional. With the optional backend (below) prices, history and news are **real market data**; without it everything is simulated and labelled. Not affiliated with any broker.

## Run locally
Open `index.html` directly, or serve the folder:

    npx serve .        # or: python -m http.server 8080

## Structure
    index.html          shell, header, nav mount, script tags (cache-busting ?v=)
    css/styles.css      design tokens + all styles (sky blue primary, amber secondary, WCAG 2.2 AA)
    js/config.js        runtime settings: apiBase (null = pure simulation)
    js/data.js          securities catalogue (simulated fallback prices), lessons, models
    js/news.js          simulated news generator (fallback only)
    js/live.js          real-data layer: quotes, history, news, 'Explain this move' via the backend
    backend/            AWS Lambda + HTTP API (index.mjs, template.yaml)
    js/store.js         state, trading engine, price ticks, persistence (localStorage)   <-- only file that touches storage
    js/ui.js            formatting, charts (SVG), form helpers, dialog/toast
    js/pages-a.js       Accounts & Trade pages
    js/pages-b.js       Investing, Retirement, Wealth Management, News, Quote pages
    js/app.js           navigation, hash router, event delegation, live updates
    js/snowbull-*.js    SnowBull AI embed (assistant page + floating widget); copied from snowbull/ by `npm run sync`
    css/snowbull.css    SnowBull styles (copied)
    snowbull/           SnowBull AI: RAG engine, Vercel API and standalone app (see snowbull/README.md)
    deploy/             AWS helpers

## Deploy to AWS (S3 + CloudFront)
Hash routing (`#portfolio`) means **no SPA rewrite rules** are needed on S3/CloudFront, and all asset paths are relative.

1. Create a **private** S3 bucket (Block Public Access ON).
2. Create a CloudFront distribution: origin = the bucket with **Origin Access Control**, default root object `index.html`,
   viewer protocol policy "Redirect HTTP to HTTPS". Apply the bucket policy CloudFront suggests.
3. Create the security-headers policy and attach it to the default behavior:

       aws cloudfront create-response-headers-policy --response-headers-policy-config file://deploy/cloudfront-security-headers.json

   The CSP is strict (`script-src 'self'`, no inline scripts/styles, no third-party hosts) — the app is built to satisfy it.
4. Deploy (PowerShell):

       .\deploy\deploy.ps1 -Bucket <bucket> -DistributionId <id>

Alternative: AWS Amplify Hosting — connect the Git repo, no build command, output directory `/`.
Optional: Route 53 + ACM certificate (us-east-1) for a custom domain.

When you change JS/CSS, bump `?v=1.0.0` in `index.html` and redeploy.

## Making it "real" later
`js/store.js` (`SB.load`, `SB.save`) is the single persistence boundary. To add accounts and cloud sync,
replace those two functions with calls to API Gateway + Lambda (DynamoDB for state, Cognito for sign-in);
the UI does not need to change. Real market data or an LLM news writer should also be called from Lambda,
never directly from the browser (keep API keys server-side).

## Accessibility notes
Skip link, landmarks, one h1 per view (focus moves to it on navigation), keyboard-operable menus (Esc closes),
visible focus rings, 44px targets, text-size controls, high-contrast mode, pause control for live prices,
arrows + words (not colour alone) for gains/losses, text alternatives for every chart, reduced-motion support.

## Real market data (optional backend)
Browsers must not hold API keys, so a small Lambda sits between the app and the data providers:

| Data | Provider | Key |
|---|---|---|
| Stock and ETF quotes, market news | Finnhub | free key |
| Daily and intraday price history | Twelve Data | free key (800 credits/day, 8/min) |
| Treasury, TIPS and corporate-bond yields | FRED (St. Louis Fed) | free key |
| "Explain this move" summaries | OpenAI API | your key |

1. Get the keys you want (all optional; the app labels anything it cannot price as *Simulated*).
2. `.\deploy\deploy-backend.ps1 -SiteOrigin https://YOUR-CLOUDFRONT-DOMAIN` (needs AWS CLI and SAM CLI). It deploys the API, writes the URL into `js/config.js` and into the CSP `connect-src` in `deploy/cloudfront-security-headers.json`.
3. Apply the updated headers policy: `aws cloudfront update-response-headers-policy --id <policy-id> --if-match <etag> --response-headers-policy-config file://deploy/cloudfront-security-headers.json` (get the id and etag with `aws cloudfront get-response-headers-policy`).
4. `.\deploy\deploy.ps1 -Bucket ... -DistributionId ...`.

Notes
- Mutual-fund NAVs and municipal bonds have no free provider, so those stay simulated (Twelve Data's Pro plan adds fund NAV).
- Bond prices are modeled from the real yield for a bond with the stated coupon and maturity.
- Quotes refresh about once a minute (cached server-side). Stock and ETF orders fill only while the U.S. market is open, at the latest real price.
- Free data plans are generally for personal, non-commercial use. Read each provider's terms before making the site public.
- Keys live in Lambda environment variables. For stricter handling, move them to AWS Secrets Manager.
- Test locally without AWS: leave `apiBase: null`.

## SnowBull AI (assistant)
A retrieval-augmented investing assistant with live data and scam/risk alerts. It is embedded here (nav item **SnowBull AI** and the floating *Ask SnowBull* button) and also deploys standalone on Vercel from `snowbull/`. Set `snowbullApi` in `js/config.js` and add the same origin to `connect-src` in `deploy/cloudfront-security-headers.json`. Without it the assistant runs offline in the browser. Details: `snowbull/README.md`.
