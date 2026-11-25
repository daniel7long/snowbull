/* POST /api/chat  { message, history?, context? }  ->  { answer, sources, risks, followups, mode, ... }
 * Pipeline: sanitize -> detect tickers -> fetch live quotes/news -> retrieve (BM25 over KB + live docs) -> scan risks
 * -> compose grounded answer -> optional LLM rewrite (guarded) -> respond. */
'use strict';
const core = require('../public/core/snowbull-core.js');
const live = require('./_lib/live.js');
const llm = require('./_lib/llm.js');

const ALLOW = process.env.SNOWBULL_ALLOW_ORIGIN || '*'; // comma-separated origins, e.g. https://snowball.example.com
const hits = new Map();
function limited(ip) {
  const now = Date.now(), a = (hits.get(ip) || []).filter((t) => now - t < 60e3);
  a.push(now); hits.set(ip, a); if (hits.size > 2000) hits.delete(hits.keys().next().value);
  return a.length > 20;
}
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const num = (v) => (Number.isFinite(+v) ? +v : 0);
function sanitize(b) {
  const c = b.context || {};
  return {
    message: str(b.message, 1500).trim(),
    history: (Array.isArray(b.history) ? b.history : []).slice(-8).map((h) => ({ role: h && h.role === 'assistant' ? 'assistant' : 'user', content: str(h && h.content, 1500) })),
    context: {
      route: str(c.route, 40),
      symbols: (Array.isArray(c.symbols) ? c.symbols : []).slice(0, 80).map((s) => ({ sym: str(s && s.sym, 8).toUpperCase(), name: str(s && s.name, 60), type: str(s && s.type, 10), price: num(s && s.price), prev: num(s && s.prev), src: str(s && s.src, 8), asOf: num(s && s.asOf) })).filter((s) => /^[A-Z0-9.]{1,8}$/.test(s.sym)),
      news: (Array.isArray(c.news) ? c.news : []).slice(0, 25).map((n) => ({ title: str(n && n.title, 200), sym: str(n && n.sym, 8), ts: num(n && n.ts), source: str(n && n.source, 40) })).filter((n) => n.title),
      portfolio: c.portfolio && Array.isArray(c.portfolio.positions) ? { total: num(c.portfolio.total), cash: num(c.portfolio.cash), positions: c.portfolio.positions.slice(0, 80).map((p) => ({ sym: str(p && p.sym, 8), name: str(p && p.name, 60), type: str(p && p.type, 10), value: num(p && p.value) })) } : null
    }
  };
}
function cors(req, res) {
  const origin = req.headers.origin, list = ALLOW.split(',').map((s) => s.trim());
  if (ALLOW === '*') res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && list.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Cache-Control', 'no-store');
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'ip';
  if (limited(ip)) return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const input = sanitize(body || {});
  if (!input.message) return res.status(400).json({ error: 'message is required' });
  try {
    const known = {}; input.context.symbols.forEach((s) => { known[s.sym] = s; });
    const tickers = core.extractTickers(input.message, Object.keys(known).length ? known : null);
    const wantsNews = /(news|why|latest|today|happen|current|market)/i.test(input.message);
    const [q, n] = await Promise.all([tickers.length ? live.quotes(tickers) : {}, tickers.length || wantsNews ? live.news(tickers) : []]);
    input.live = { quotes: q, news: n.concat(input.context.news) };
    const out = core.answer(input);
    let mode = 'local';
    if (llm.enabled()) {
      const text = await llm.rewrite(core.buildPrompt(out, input), input.history);
      if (text) { out.answer = text; mode = 'rag+llm'; }
    }
    out.mode = mode; out.live = { quotes: Object.keys(q).length, news: n.length, asOf: Date.now() };
    out.retrieved = out.retrieved.map((r) => ({ id: r.id, title: r.title, score: r.score, live: r.live })); // do not ship passage text
    return res.status(200).json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'SnowBull hit a problem. Please try again.' });
  }
};
