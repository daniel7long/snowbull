/* SnowBall+ data API — AWS Lambda (Node.js 20+, no dependencies).
 * Routes (HTTP API, payload v2):
 *   GET  /api/health
 *   GET  /api/quotes                       -> latest price + previous close for every symbol
 *   GET  /api/history?symbols=A,B          -> daily closes (about 1 year)
 *   GET  /api/intraday?symbol=A            -> intraday points for today
 *   GET  /api/fundamentals?symbols=A,B     -> market cap, P/E, dividend yield, 52-week range, average volume
 *   GET  /api/news[?symbol=A]              -> market news (or company news when symbol is given)
 *   POST /api/explain {symbol}             -> short OpenAI summary built ONLY from the data above
 * Environment: FINNHUB_KEY, TWELVE_KEY, FRED_KEY, OPENAI_API_KEY, OPENAI_MODEL, ALLOW_ORIGIN
 * Every provider is optional. A symbol that no provider can price is returned with src:"none"
 * so the browser can label it instead of showing a made-up number.
 */
const E = process.env;
const ALLOW_ORIGIN = E.ALLOW_ORIGIN || '*';
const OPENAI_MODEL = E.OPENAI_MODEL || 'gpt-4o-mini';

/* sym -> kind. stock/etf: Finnhub quote + Twelve Data history. fund: Twelve Data only (NAV; may need a paid plan).
 * bond: derived from a FRED yield series. */
export const UNIVERSE = {
  AAPL: 'stock', MSFT: 'stock', NVDA: 'stock', AMZN: 'stock', GOOGL: 'stock', META: 'stock', TSLA: 'stock', JPM: 'stock',
  V: 'stock', JNJ: 'stock', XOM: 'stock', WMT: 'stock', KO: 'stock', DIS: 'stock', NFLX: 'stock', PG: 'stock',
  SPY: 'etf', QQQ: 'etf', VTI: 'etf', VXUS: 'etf', BND: 'etf', SCHD: 'etf', VNQ: 'etf', GLD: 'etf',
  FXAIX: 'fund', FZROX: 'fund', FSKAX: 'fund', FSPSX: 'fund', FXNAX: 'fund', FBALX: 'fund'
};
// bond sym -> FRED series, coupon (%), years to maturity. Price is modelled from the real yield.
export const BONDS = {
  TBILL3M: { fred: 'DGS3MO', coupon: 0, years: 0.25 },
  UST2Y: { fred: 'DGS2', coupon: 4.0, years: 2 },
  UST10Y: { fred: 'DGS10', coupon: 4.25, years: 10 },
  TIPS5Y: { fred: 'DFII5', coupon: 1.5, years: 5 },
  CORP5Y: { fred: 'BAMLC0A3CAEY', coupon: 5.0, years: 5 } // ICE BofA single-A effective yield
};
const ALL = Object.keys(UNIVERSE).concat(Object.keys(BONDS), ['MUNI10Y']);

/* ---------- tiny cache (per warm container) ---------- */
const cache = new Map();
async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.val;
  if (hit && hit.pending) return hit.pending;
  const pending = loader().then(function (val) { cache.set(key, { exp: Date.now() + ttlMs, val: val }); return val; },
    function (err) { if (hit) return hit.val; cache.delete(key); throw err; }); // serve stale on failure
  cache.set(key, Object.assign({}, hit || { exp: 0 }, { pending: pending }));
  return pending;
}

async function getJson(url, ms) {
  const c = new AbortController(); const t = setTimeout(function () { c.abort(); }, ms || 6000);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function pool(items, size, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async function () {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = null; } }
  }));
  return out;
}

/* ---------- market hours (US regular session, ET; holidays are caught by stale timestamps) ---------- */
export function marketOpen(now) {
  const d = new Date(now || Date.now());
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d);
  const g = function (t) { return (p.find(function (x) { return x.type === t; }) || {}).value; };
  const wd = g('weekday'), mins = (+g('hour') % 24) * 60 + (+g('minute'));
  return !(wd === 'Sat' || wd === 'Sun') && mins >= 9 * 60 + 30 && mins < 16 * 60;
}

/* ---------- bond maths ---------- */
export function bondPrice(yieldPct, coupon, years) {
  const y = yieldPct / 100;
  if (coupon === 0) return 100 / (1 + y * years);
  const n = Math.round(years * 2), c = coupon / 2, r = y / 2;
  let p = 0; for (let k = 1; k <= n; k++) p += c / Math.pow(1 + r, k);
  return p + 100 / Math.pow(1 + r, n);
}

/* ---------- FRED ---------- */
async function fredSeries(id) {
  if (!E.FRED_KEY) throw new Error('no FRED key');
  return cached('fred:' + id, 3600e3, async function () {
    const u = 'https://api.stlouisfed.org/fred/series/observations?series_id=' + id + '&api_key=' + E.FRED_KEY + '&file_type=json&sort_order=desc&limit=290';
    const j = await getJson(u, 8000);
    const rows = (j.observations || []).filter(function (o) { return o.value !== '.' && isFinite(+o.value); })
      .map(function (o) { return { d: o.date, y: +o.value }; }).reverse();
    if (rows.length < 3) throw new Error('empty series');
    return rows;
  });
}

/* ---------- quotes ---------- */
async function finnhubQuote(sym) {
  const j = await getJson('https://finnhub.io/api/v1/quote?symbol=' + sym + '&token=' + E.FINNHUB_KEY);
  if (!j || !(j.c > 0) || !(j.pc > 0)) throw new Error('no quote');
  return { price: j.c, prev: j.pc, ts: (j.t || 0) * 1000, src: 'finnhub' };
}
async function twelveQuote(sym) {
  const j = await getJson('https://api.twelvedata.com/quote?symbol=' + sym + '&apikey=' + E.TWELVE_KEY);
  if (j.status === 'error' || !(+j.close > 0)) throw new Error('no quote');
  return { price: +j.close, prev: +j.previous_close, ts: (j.timestamp || 0) * 1000, src: 'twelvedata' };
}
async function oneQuote(sym) {
  const kind = UNIVERSE[sym];
  if (kind === 'stock' || kind === 'etf') {
    if (E.FINNHUB_KEY) { try { return await finnhubQuote(sym); } catch (e) { /* fall through */ } }
    if (E.TWELVE_KEY) return twelveQuote(sym);
    throw new Error('no provider');
  }
  if (kind === 'fund') { if (E.TWELVE_KEY) return twelveQuote(sym); throw new Error('no provider'); }
  const b = BONDS[sym];
  if (b) {
    const rows = await fredSeries(b.fred), last = rows[rows.length - 1], before = rows[rows.length - 2];
    return { price: bondPrice(last.y, b.coupon, b.years), prev: bondPrice(before.y, b.coupon, b.years), ts: Date.parse(last.d + 'T21:00:00Z'), src: 'fred', yield: last.y };
  }
  throw new Error('unsupported');
}
async function allQuotes() {
  const open = marketOpen();
  const ttl = open ? 60e3 : 15 * 60e3;
  const syms = ALL.filter(function (s) { return s !== 'MUNI10Y'; });
  const res = await pool(syms, 8, function (s) { return cached('q:' + s, ttl, function () { return oneQuote(s); }); });
  const quotes = {};
  syms.forEach(function (s, i) { if (res[i]) quotes[s] = res[i]; });
  return { asOf: Date.now(), open: open, quotes: quotes, missing: ALL.filter(function (s) { return !quotes[s]; }) };
}

/* ---------- history (daily closes) ---------- */
async function twelveSeries(sym, interval, size) {
  if (!E.TWELVE_KEY) throw new Error('no Twelve Data key');
  const j = await getJson('https://api.twelvedata.com/time_series?symbol=' + sym + '&interval=' + interval + '&outputsize=' + size + '&order=ASC&apikey=' + E.TWELVE_KEY, 9000);
  if (j.status === 'error' || !Array.isArray(j.values) || j.values.length < 5) throw new Error('no series');
  return j.values.map(function (v) { return { t: v.datetime, c: +v.close }; }).filter(function (v) { return v.c > 0; });
}
async function history(sym) {
  return cached('h:' + sym, 6 * 3600e3, async function () {
    if (BONDS[sym]) {
      const b = BONDS[sym], rows = await fredSeries(b.fred);
      return { sym: sym, src: 'fred', dates: rows.map(function (r) { return r.d; }), closes: rows.map(function (r) { return +bondPrice(r.y, b.coupon, b.years).toFixed(3); }) };
    }
    const rows = await twelveSeries(sym, '1day', 262);
    return { sym: sym, src: 'twelvedata', dates: rows.map(function (r) { return r.t.slice(0, 10); }), closes: rows.map(function (r) { return r.c; }) };
  });
}
/* Twelve Data's free plan allows 8 credits a minute, so each call only starts a few uncached symbols;
 * the browser asks again for the ones listed in "pending". */
async function histories(symbols) {
  const out = {}, pending = [], fresh = [];
  let budget = 6;
  for (const s of symbols) {
    if (!ALL.includes(s) || s === 'MUNI10Y') continue;
    const hit = cache.get('h:' + s);
    if (hit && hit.exp > Date.now()) { out[s] = hit.val; continue; }
    if (BONDS[s]) { fresh.push(s); continue; }
    if (budget > 0) { budget--; fresh.push(s); } else pending.push(s);
  }
  const got = await pool(fresh, 6, history);
  fresh.forEach(function (s, i) { if (got[i]) out[s] = got[i]; });
  return { histories: out, pending: pending, failed: fresh.filter(function (s, i) { return !got[i]; }) };
}
async function intraday(sym) {
  if (!UNIVERSE[sym] || UNIVERSE[sym] === 'fund') throw new Error('no intraday');
  return cached('i:' + sym, 5 * 60e3, async function () {
    const rows = await twelveSeries(sym, '5min', 78);
    const day = rows[rows.length - 1].t.slice(0, 10);
    const today = rows.filter(function (r) { return r.t.slice(0, 10) === day; });
    return { sym: sym, src: 'twelvedata', day: day, t: today.map(function (r) { return r.t; }), v: today.map(function (r) { return r.c; }) };
  });
}

/* ---------- fundamentals (Finnhub basic financials + profile; ETFs get metrics only) ---------- */
const num = function (v) { return typeof v === 'number' && isFinite(v) ? v : null; };
async function fundamentals(sym) {
  return cached('f:' + sym, 24 * 3600e3, async function () {
    if (!E.FINNHUB_KEY) throw new Error('no Finnhub key');
    const base = 'https://finnhub.io/api/v1/', tk = '&token=' + E.FINNHUB_KEY;
    const jobs = [getJson(base + 'stock/metric?symbol=' + sym + '&metric=all' + tk, 8000).catch(function () { return null; })];
    jobs.push(UNIVERSE[sym] === 'stock' ? getJson(base + 'stock/profile2?symbol=' + sym + tk, 8000).catch(function () { return null; }) : Promise.resolve(null));
    const both = await Promise.all(jobs), m = both[0], p = both[1];
    if (!m && !p) throw new Error('no fundamentals');
    const x = (m && m.metric) || {};
    const first = function () { for (let i = 0; i < arguments.length; i++) { const v = num(arguments[i]); if (v !== null) return v; } return null; };
    return {
      sym: sym, src: 'finnhub',
      marketCapM: first(p && p.marketCapitalization, x.marketCapitalization),          // millions of USD
      industry: (p && p.finnhubIndustry) || null,
      pe: first(x.peTTM, x.peBasicExclExtraTTM, x.peNormalizedAnnual),
      divYield: first(x.dividendYieldIndicatedAnnual, x.currentDividendYieldTTM),      // percent
      high52: first(x['52WeekHigh']), low52: first(x['52WeekLow']),
      avgVolM: first(x['3MonthAverageTradingVolume'], x['10DayAverageTradingVolume']), // millions of shares
      beta: first(x.beta)
    };
  });
}

/* ---------- news (headline + link + short snippet, never full articles) ---------- */
function snippet(s) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > 220 ? s.slice(0, 217).replace(/\s\S*$/, '') + '…' : s; }
async function news(sym) {
  if (!E.FINNHUB_KEY) throw new Error('no Finnhub key');
  return cached('n:' + (sym || '*'), 5 * 60e3, async function () {
    let list;
    if (sym && UNIVERSE[sym]) {
      const to = new Date(), from = new Date(Date.now() - 7 * 864e5), f = function (d) { return d.toISOString().slice(0, 10); };
      list = await getJson('https://finnhub.io/api/v1/company-news?symbol=' + sym + '&from=' + f(from) + '&to=' + f(to) + '&token=' + E.FINNHUB_KEY);
    } else list = await getJson('https://finnhub.io/api/v1/news?category=general&token=' + E.FINNHUB_KEY);
    return (Array.isArray(list) ? list : []).slice(0, 30).map(function (n) {
      return { id: String(n.id), ts: (n.datetime || 0) * 1000, cat: sym ? 'Company' : 'Markets', sym: sym || null, title: String(n.headline || '').slice(0, 200), summary: snippet(n.summary), source: String(n.source || ''), url: /^https?:\/\//.test(n.url) ? n.url : '' };
    }).filter(function (n) { return n.title && n.url; });
  });
}

/* ---------- OpenAI explainer (only restates the data it is given) ---------- */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(function (t) { return now - t < 60e3; });
  arr.push(now); hits.set(ip, arr); return arr.length > 6;
}
async function explain(sym) {
  if (!E.OPENAI_API_KEY) throw new Error('no OpenAI key');
  return cached('x:' + sym, 15 * 60e3, async function () {
    const q = (await allQuotes()).quotes[sym]; if (!q) throw new Error('no quote');
    let heads = []; try { heads = (await news(UNIVERSE[sym] ? sym : null)).slice(0, 6); } catch (e) { /* optional */ }
    const chg = ((q.price / q.prev - 1) * 100).toFixed(2);
    const facts = 'Symbol: ' + sym + '\nLast price: ' + q.price.toFixed(2) + '\nPrevious close: ' + q.prev.toFixed(2) + '\nChange: ' + chg + '%\nHeadlines:\n' + (heads.map(function (h) { return '- ' + h.title + ' (' + h.source + ')'; }).join('\n') || '(none)');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + E.OPENAI_API_KEY },
      body: JSON.stringify({ model: OPENAI_MODEL, temperature: 0.2, max_tokens: 220, messages: [
        { role: 'system', content: 'You explain market moves to beginners in 2-3 plain sentences. Use ONLY the facts given. If the headlines do not explain the move, say the cause is not clear from the headlines. Never predict prices and never give investment advice.' },
        { role: 'user', content: facts }] })
    });
    if (!r.ok) throw new Error('openai ' + r.status);
    const j = await r.json();
    return { sym: sym, text: String(j.choices && j.choices[0] && j.choices[0].message.content || '').trim(), model: OPENAI_MODEL, basedOn: heads.map(function (h) { return { title: h.title, url: h.url, source: h.source }; }) };
  });
}

/* ---------- HTTP plumbing ---------- */
function reply(status, body, maxAge) {
  return { statusCode: status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': ALLOW_ORIGIN, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'x-content-type-options': 'nosniff' }, maxAge ? { 'cache-control': 'public, max-age=' + maxAge } : { 'cache-control': 'no-store' }), body: JSON.stringify(body) };
}
const SYM = /^[A-Z0-9.]{1,10}$/;
export async function handler(event) {
  const method = (event.requestContext && event.requestContext.http && event.requestContext.http.method) || event.httpMethod || 'GET';
  const path = String(event.rawPath || event.path || '/').replace(/\/+$/, '');
  const qs = event.queryStringParameters || {};
  if (method === 'OPTIONS') return reply(204, {});
  try {
    if (path.endsWith('/api/health')) return reply(200, { ok: true, providers: { finnhub: !!E.FINNHUB_KEY, twelvedata: !!E.TWELVE_KEY, fred: !!E.FRED_KEY, openai: !!E.OPENAI_API_KEY } }, 30);
    if (path.endsWith('/api/quotes')) return reply(200, await allQuotes(), 20);
    if (path.endsWith('/api/history')) {
      const syms = String(qs.symbols || '').toUpperCase().split(',').filter(function (s) { return SYM.test(s); }).slice(0, 40);
      if (!syms.length) return reply(400, { error: 'symbols required' });
      return reply(200, await histories(syms), 30);
    }
    if (path.endsWith('/api/intraday')) {
      const s = String(qs.symbol || '').toUpperCase(); if (!SYM.test(s)) return reply(400, { error: 'bad symbol' });
      return reply(200, await intraday(s), 60);
    }
    if (path.endsWith('/api/fundamentals')) {
      const syms = String(qs.symbols || '').toUpperCase().split(',').filter(function (v) { return SYM.test(v) && (UNIVERSE[v] === 'stock' || UNIVERSE[v] === 'etf'); }).slice(0, 40);
      if (!syms.length) return reply(400, { error: 'symbols required' });
      const got = await pool(syms, 4, fundamentals), out = {}, failed = [];
      syms.forEach(function (v, i) { if (got[i]) out[v] = got[i]; else failed.push(v); });
      return reply(200, { fundamentals: out, failed: failed }, 3600);
    }
    if (path.endsWith('/api/news')) {
      const s = String(qs.symbol || '').toUpperCase(); if (s && !SYM.test(s)) return reply(400, { error: 'bad symbol' });
      return reply(200, { items: await news(s || null) }, 120);
    }
    if (path.endsWith('/api/explain') && method === 'POST') {
      const ip = (event.requestContext && event.requestContext.http && event.requestContext.http.sourceIp) || 'x';
      if (limited(ip)) return reply(429, { error: 'Too many requests. Try again in a minute.' });
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { /* ignore */ }
      const s = String(b.symbol || '').toUpperCase(); if (!ALL.includes(s)) return reply(400, { error: 'unknown symbol' });
      return reply(200, await explain(s));
    }
    return reply(404, { error: 'not found' });
  } catch (e) {
    console.error(path, e && e.message);
    return reply(502, { error: 'Data provider unavailable', detail: String(e && e.message || e).slice(0, 120) });
  }
}
