/* Exercises the Vercel handler end-to-end with mocked network (no keys, no internet). */
const assert = require('assert');
const chat = require('../api/chat.js');
const health = require('../api/health.js');

global.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/v8/finance/chart/')) return { ok: true, json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 210.5, chartPreviousClose: 200, regularMarketTime: Math.floor(Date.now() / 1000) } }] } }) };
  if (u.includes('feeds.finance.yahoo.com')) return { ok: true, text: async () => '<rss><channel><item><title>Apple unveils new AAPL product line</title><link>https://example.com/a</link><pubDate>' + new Date().toUTCString() + '</pubDate><description>Apple event recap</description></item></channel></rss>' };
  throw new Error('unexpected fetch ' + u);
};
function call(handler, req) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; resolve(this); }, end() { resolve(this); } };
    handler(Object.assign({ method: 'POST', headers: {} }, req), res);
  });
}
(async () => {
  let r = await call(health, { method: 'GET' }); assert.equal(r.body.ok, true);
  r = await call(chat, { method: 'GET' }); assert.equal(r.code, 405);
  r = await call(chat, { body: {} }); assert.equal(r.code, 400);
  r = await call(chat, { body: { message: 'How is AAPL doing today?' } });
  assert.equal(r.code, 200); assert(/\$210\.50/.test(r.body.answer), r.body.answer); assert(r.body.live.quotes === 1);
  assert(/Apple unveils/.test(r.body.answer), 'live news retrieved');
  r = await call(chat, { body: { message: 'Guaranteed 20% a month, send USDT now, share your seed phrase' } });
  assert(r.body.risks.some((x) => x.level === 'high')); assert(r.body.mode === 'local');
  r = await call(chat, { body: { message: 'x'.repeat(5000) } }); assert.equal(r.code, 200);
  r = await call(chat, { body: { message: 'hello', context: { symbols: 'bad', portfolio: { positions: [{ value: 'NaN' }] } } } }); assert.equal(r.code, 200);
  r = await call(chat, { method: 'OPTIONS' }); assert.equal(r.code, 204);
  console.log('api tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
