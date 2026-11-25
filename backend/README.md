# SnowBall+ data API
Single dependency-free Lambda (`index.mjs`, Node 20) behind an API Gateway HTTP API. See the main README, "Real market data".

Routes: `GET /api/health`, `/api/quotes`, `/api/history?symbols=A,B`, `/api/intraday?symbol=A`, `/api/news[?symbol=A]`, `POST /api/explain {symbol}`.

Caching is in memory per warm container (quotes 60 s while the market is open, 15 min when closed; history 6 h; news 5 min). Twelve Data's free plan allows 8 credits a minute, so `/api/history` starts at most 6 uncached symbols per call and lists the rest under `pending`; the app asks again every 20 seconds until all are loaded. To keep the cache across cold starts, store the same entries in DynamoDB.
