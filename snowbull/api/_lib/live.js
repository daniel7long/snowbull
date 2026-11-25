/* Live-data retrieval for SnowBull (server side). Every provider is optional; failures return nothing,
 * never invented numbers. Finnhub (FINNHUB_KEY) is preferred; Yahoo Finance public endpoints are the keyless fallback. */
'use strict';
const E = process.env;
const cache = new Map();

async function getJson(url, ms) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 5000);
  try { const r = await fetch(url, { signal: c.signal, headers: { accept: 'application/json', 'user-agent': 'SnowBull/1.0' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function getText(url, ms) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 5000);
  try { const r = await fetch(url, { signal: c.signal, headers: { 'user-agent': 'SnowBull/1.0' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); }
  finally { clearTimeout(t); }
}
async function memo(key, ttl, fn) {
  const h = cache.get(key); if (h && h.exp > Date.now()) return h.val;
  try { const val = await fn(); cache.set(key, { exp: Date.now() + ttl, val }); if (cache.size > 300) cache.delete(cache.keys().next().value); return val; }
  catch (e) { if (h) return h.val; return null; }
}

async function quote(sym) {
  return memo('q:' + sym, 60e3, async () => {
    if (E.FINNHUB_KEY) {
      try {
        const j = await getJson('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(sym) + '&token=' + E.FINNHUB_KEY);
        if (j && j.c > 0) return { price: j.c, prev: j.pc || j.c, asOf: (j.t || 0) * 1000 || Date.now(), src: 'real', provider: 'Finnhub' };
      } catch (e) { /* fall through to Yahoo */ }
    }
    const j = await getJson('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=5d&interval=1d');
    const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
    if (m && m.regularMarketPrice > 0) return { price: m.regularMarketPrice, prev: m.chartPreviousClose || m.previousClose || m.regularMarketPrice, asOf: (m.regularMarketTime || 0) * 1000 || Date.now(), src: 'real', provider: 'Yahoo Finance' };
    return null;
  });
}
async function quotes(symbols) {
  const out = {};
  await Promise.all(symbols.slice(0, 5).map(async (s) => { const q = await quote(s); if (q) out[s] = q; }));
  return out;
}

const decode = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/<[^>]+>/g, '').trim();
async function news(symbols) {
  const key = 'n:' + symbols.join(',');
  const r = await memo(key, 5 * 60e3, async () => {
    const out = [];
    if (E.FINNHUB_KEY) {
      const to = new Date(), from = new Date(Date.now() - 5 * 864e5), d = (x) => x.toISOString().slice(0, 10);
      const urls = symbols.length
        ? symbols.slice(0, 2).map((s) => 'https://finnhub.io/api/v1/company-news?symbol=' + encodeURIComponent(s) + '&from=' + d(from) + '&to=' + d(to) + '&token=' + E.FINNHUB_KEY)
        : ['https://finnhub.io/api/v1/news?category=general&token=' + E.FINNHUB_KEY];
      for (const u of urls) {
        try { (await getJson(u)).slice(0, 8).forEach((n) => out.push({ title: n.headline, summary: n.summary && n.summary.slice(0, 300), ts: (n.datetime || 0) * 1000, source: n.source, url: n.url, sym: n.related })); } catch (e) { /* try next */ }
      }
    }
    if (!out.length) {
      const feeds = symbols.length
        ? symbols.slice(0, 2).map((s) => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=' + encodeURIComponent(s) + '&region=US&lang=en-US')
        : ['https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US'];
      for (const u of feeds) {
        try {
          const x = await getText(u);
          (x.match(/<item>[\s\S]*?<\/item>/g) || []).slice(0, 8).forEach((it) => {
            const g = (t) => { const m = it.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>')); return m ? decode(m[1]) : ''; };
            const link = g('link');
            out.push({ title: g('title'), summary: g('description').slice(0, 300), ts: Date.parse(g('pubDate')) || Date.now(), source: 'Yahoo Finance', url: /^https?:\/\//.test(link) ? link : '' });
          });
        } catch (e) { /* ignore */ }
      }
    }
    return out.filter((n) => n.title).sort((a, b) => b.ts - a.ts).slice(0, 12);
  });
  return r || [];
}
module.exports = { quotes, news };
