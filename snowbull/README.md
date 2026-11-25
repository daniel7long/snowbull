# SnowBull AI

A retrieval-augmented (RAG) fintech assistant. It works **inside SnowBall+** (floating assistant + a "SnowBull AI" page) and **on its own** as a Vercel app. Same sky-blue + amber design as SnowBall+.

| Goal | How SnowBull does it |
|---|---|
| Factual, contextually accurate | Answers are composed only from retrieved passages of a curated library (`public/core/knowledge.js`: SEC, FINRA, IRS, FTC, SIPC guidance) and cited. If nothing relevant is found it says so instead of guessing. |
| More current than a normal model | At question time it fetches live quotes and headlines (Finnhub, or Yahoo Finance with no key), adds them to the retrieval pool, and ranks by relevance **and freshness**. Inside SnowBall+ it also uses the prices and real headlines the app is showing. |
| Best-practice advice | Intent detection + a profile parser (age, horizon, risk comfort, amount) → an educational asset-mix starting point, trade-offs and next steps; checks your holdings for concentration. Not personalised investment advice. |
| Detect and report risk / fraud | A deterministic scanner (`scanRisks`) runs on **every** message, independent of any LLM: guaranteed-return and Ponzi language, pump-and-dump, phishing/credential requests, advance-fee and recovery scams, off-platform steering; plus margin, options, leveraged ETFs, panic selling, FOMO, concentration and unusual price moves. Alerts show a level, why, and what to do (icon + word + border, never colour alone). |

## Architecture

```
browser (SnowBull UI) ──POST /api/chat──▶ Vercel function
                                          1 sanitize + rate-limit
                                          2 detect tickers  → live quotes + news (cached)
                                          3 retrieve        → BM25 over KB + live docs (recency boost)
                                          4 scan risks      → fraud + trading rules
                                          5 compose         → grounded, cited draft
                                          6 optional LLM    → rewrites wording only (guarded)
        ▲ if the API is unreachable, the same core (public/core) runs in the browser: "Offline mode"
```

* `public/core/` — engine shared by server and browser (no dependencies, no network).
* `api/chat.js`, `api/health.js`, `api/_lib/` — Vercel functions.
* `public/` — standalone site (`index.html`, `app.js`, `base.css`, `snowbull.css`, `snowbull-ui.js`).
* The LLM step (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) is optional. The model only *rewrites* the grounded draft; any answer that introduces numbers missing from the sources is discarded in favour of the draft.

## Run locally

```bash
cd snowbull
npm test            # engine + API tests (no network needed)
npm run dev         # http://localhost:3000  (static site + /api, like `vercel dev`)
```

## Deploy on Vercel

1. Import the repo in Vercel and set **Root Directory** to `snowbull`. No build command; output is `public` (already in `vercel.json`).
2. Environment variables (all optional, see `.env.example`): `OPENAI_API_KEY` / `OPENAI_MODEL` (or `ANTHROPIC_API_KEY` / `SNOWBULL_MODEL`), `FINNHUB_KEY`, `SNOWBULL_ALLOW_ORIGIN`.
3. Set `SNOWBULL_ALLOW_ORIGIN` to your SnowBall+ origin (e.g. `https://d123.cloudfront.net`) so only your site can call the API from a browser.
4. Optional: set `snowballUrl` in `public/config.js` to show an "Open SnowBall+" button.

## Connect it to SnowBall+

1. `js/config.js` → set `snowbullApi: "https://YOUR-SNOWBULL.vercel.app"` (leave `null` for offline mode).
2. Add that origin to `connect-src` in `deploy/cloudfront-security-headers.json`, then update the CloudFront headers policy (see the root README).
3. After editing anything in `snowbull/public`, run `npm run sync` (copies the engine, UI and CSS into `../js` and `../css`), bump the `?v=` numbers in `../index.html`, and redeploy SnowBall+.

SnowBall+ passes SnowBull the securities and prices it displays (labelled real or simulated), genuine headlines only (simulated stories are never sent), and the active practice account's holdings. Nothing is stored server-side.

## Extending the knowledge base

Add an object to `public/core/knowledge.js` (`id`, `cat`, `title`, `src`, `tags`, `text`). Keep entries short, factual and attributable to a named source; they are indexed automatically. For a larger corpus, replace `retrieve()` with a vector store (pgvector, Upstash Vector) — `answer()` only needs `{doc, score}` results.

## Safety notes

* Educational information only; every answer carries a disclaimer. SnowBull never asks for passwords, codes, card numbers or seed phrases and tells users not to share them.
* Free/keyless market-data endpoints (Yahoo Finance) are unofficial and may be delayed or change; set `FINNHUB_KEY` for production and review each provider's terms.
* The rule-based detector reduces, but cannot eliminate, missed or false alerts. Treat it as a safety net, not a guarantee.
