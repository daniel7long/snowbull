/* SnowBall+ — real market data layer.
 * Money, accounts and orders stay fictional and live in the browser. Prices, price history and news come from
 * the backend (backend/index.mjs). Without a backend, or when it is down, the simulation is used and labelled. */
(function () {
  'use strict';
  const SB = window.SB, cfg = window.SB_CONFIG || {};
  const enabled = cfg.apiBase !== null && cfg.apiBase !== undefined;
  const base = String(cfg.apiBase || '').replace(/\/+$/, '') + '/api';
  const esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  SB.dataMode = 'sim';                 // 'real' once the backend has answered
  SB.market = { open: false, asOf: 0 };
  SB.newsError = false;
  const feed = SB.feed = { enabled: enabled, lastOk: 0, lastErr: '', symNewsCache: {}, histTries: 0 };

  function api(path, opt) {
    const c = new AbortController(), t = setTimeout(function () { c.abort(); }, 9000);
    return fetch(base + path, Object.assign({ signal: c.signal, headers: { accept: 'application/json' } }, opt || {}))
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j && j.error || 'HTTP ' + r.status); return j; }); })
      .then(function (j) { clearTimeout(t); return j; }, function (e) { clearTimeout(t); throw e; });
  }
  const ymd = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const hhmm = function (ts) { return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  const decimals = function (s) { return s.type === 'bond' ? 1000 : 100; };

  /* ---------- status text ---------- */
  feed.fresh = function () { return SB.dataMode !== 'real' || Date.now() - feed.lastOk < 10 * 60000; };
  feed.banner = function () {
    if (SB.dataMode !== 'real') return '<strong>Simulator.</strong> All money, prices, funds and news are fictional' + (enabled && feed.lastErr ? ' (the live data service could not be reached, so practice prices are shown)' : '') + '. Nothing here is investment advice.';
    return '<strong>Practice account.</strong> Your money is fictional; prices and news are real market data (' + (SB.market.open ? 'US market open' : 'US market closed') + (feed.lastOk ? ', updated ' + hhmm(feed.lastOk) : '') + (feed.fresh() ? '' : ', <em>connection lost: showing the last prices received</em>') + '). Some prices may be delayed. Nothing here is investment advice.';
  };
  feed.paintBanner = function () { const b = document.getElementById('sim-banner'); if (b) b.innerHTML = feed.banner(); };
  feed.note = function (s) {
    if (SB.dataMode !== 'real') return SB.badge('Simulated', 'sim');
    if (s.src !== 'real') return SB.badge('Simulated', 'sim') + ' <span class="muted small">Real data for this ' + (s.type === 'fund' ? 'mutual fund' : 'security') + ' is not available from the free data plan, so this price is practice-only.</span>';
    const bits = [SB.badge('Real data', 'real')];
    if (s.type === 'bond') bits.push('<span class="muted small">Yield from ' + (s.srcName === 'fred' ? 'FRED (U.S. Treasury / ICE data)' : s.srcName) + '; the price is modeled for a bond with this coupon and maturity.</span>');
    else bits.push('<span class="muted small">' + (s.type === 'fund' ? 'Latest NAV' : (SB.market.open ? 'Last trade' : 'Last close')) + (s.qts ? ' as of ' + new Date(s.qts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '') + '. May be delayed.</span>');
    return bits.join(' ');
  };
  feed.canFill = function (s) {
    if (SB.dataMode !== 'real' || s.src !== 'real') return true;
    if (!feed.fresh()) return false;
    if (s.type === 'stock' || s.type === 'etf') return SB.market.open && Date.now() - (s.qts || 0) < 60 * 60000;
    return true;
  };

  /* ---------- quotes ---------- */
  function applyQuotes(j) {
    const L = SB.dates.length; let n = 0;
    Object.keys(j.quotes || {}).forEach(function (sym) {
      const s = SB.bySym[sym], q = j.quotes[sym]; if (!s || !(q.price > 0) || !(q.prev > 0)) return;
      const d = decimals(s), first = s.src !== 'real';
      s.src = 'real'; s.srcName = q.src; s.qts = q.ts || 0; n++;
      s.prev = Math.round(q.prev * d) / d; s.price = Math.round(q.price * d) / d; s.anchor = s.price;
      if (q.yield != null) s.liveYield = q.yield;
      if (first) { s.hist = new Array(L).fill(s.price); s.hsrc = 'loading'; s.intra = [s.prev, s.price]; }
      s.hist[L - 1] = s.price;
      if (!s.intraReal) { s.intra.push(s.price); if (s.intra.length > 240) s.intra.shift(); }
    });
    SB.market = { open: !!j.open, asOf: j.asOf || Date.now() };
    return n;
  }
  feed.refresh = function () {
    if (!enabled) return Promise.resolve();
    const first = SB.dataMode !== 'real';
    return api('/quotes').then(function (j) {
      const n = applyQuotes(j);
      if (n < 10) throw new Error('too few quotes');
      feed.lastOk = Date.now(); feed.lastErr = '';
      if (first) turnOnReal(); else { feed.paintBanner(); SB.checkOrders(); SB.updateLive && SB.updateLive(); }
    }).catch(function (e) {
      feed.lastErr = String(e && e.message || e);
      feed.paintBanner();
    });
  };

  /* Re-base the starter portfolio's cost basis on real prices (only if the learner has not traded yet). */
  function rebaseSeed() {
    const st = SB.state(); if (st.rebased) return;
    if (!st.orders.some(function (o) { return o.status === 'filled'; })) {
      st.accounts.forEach(function (a) {
        Object.keys(a.positions).forEach(function (k) {
          const s = SB.bySym[k], p = a.positions[k]; if (!s || s.src !== 'real' || !s.simPrice) return;
          const ratio = p.cost / (p.qty * SB.unitAt(s, s.simPrice));
          p.cost = Math.round(p.qty * SB.unitAt(s, s.price) * ratio * 100) / 100;
        });
      });
      st.txns.forEach(function (t) {
        const s = SB.bySym[t.sym]; if (t.kind !== 'Bought' || t.orderId || !s || s.src !== 'real' || !s.simPrice) return;
        const k = s.price / s.simPrice;
        t.price = Math.round(t.price * k * 1000) / 1000; t.amount = -Math.round(Math.abs(t.amount) * k * 100) / 100;
      });
    }
    st.rebased = true; SB.save();
  }

  function turnOnReal() {
    SB.dataMode = 'real';
    rebaseSeed();
    SB.news = []; SB.newsError = false;
    feed.paintBanner();
    SB.securities.forEach(function (x) { if (x.src === 'real') x.avgVol = null; });   // the built-in volume figures were placeholders
    feed.loadHistories(); feed.loadNews();
    rerenderSoft();
  }
  function rerenderSoft() {
    const t = (document.activeElement && document.activeElement.tagName) || '';
    if (!/INPUT|TEXTAREA|SELECT/.test(t) && SB.rerender) SB.rerender(); else if (SB.updateLive) SB.updateLive();
  }

  /* ---------- history ---------- */
  function applyHistory(h) {
    const s = SB.bySym[h.sym]; if (!s || s.src !== 'real' || !h.dates || h.dates.length < 5) return;
    const L = SB.dates.length, out = new Array(L); let j = 0, last = h.closes[0];
    for (let i = 0; i < L; i++) {
      const key = ymd(SB.dates[i]);
      while (j < h.dates.length && h.dates[j] <= key) { last = h.closes[j]; j++; }
      out[i] = last;
    }
    out[L - 1] = s.price; s.hist = out; s.hsrc = 'real';
  }
  feed.loadHistories = function () {
    const want = SB.securities.filter(function (s) { return s.src === 'real' && s.hsrc !== 'real' && s.hsrc !== 'none'; }).map(function (s) { return s.sym; });
    if (!want.length) return;
    api('/history?symbols=' + want.join(',')).then(function (r) {
      Object.keys(r.histories || {}).forEach(function (k) { applyHistory(r.histories[k]); });
      (r.failed || []).forEach(function (k) { const s = SB.bySym[k]; if (s && s.hsrc !== 'real') s.hsrc = 'none'; });
      if (SB.updateLive) SB.updateLive();
      if ((r.pending || []).length && feed.histTries++ < 30) setTimeout(feed.loadHistories, 20000);
      else if ((r.pending || []).length === 0) rerenderSoft();
    }).catch(function () { if (feed.histTries++ < 6) setTimeout(feed.loadHistories, 30000); });
  };
  feed.historyNote = function (s) {
    if (SB.dataMode !== 'real' || s.src !== 'real') return '';
    if (s.hsrc === 'real') return '';
    return '<p class="muted small" role="status">' + (s.hsrc === 'none' ? 'Price history is not available for this security right now, so the chart is flat.' : 'Loading real price history…') + '</p>';
  };
  feed.ensureIntraday = function (s) {
    if (SB.dataMode !== 'real' || s.src !== 'real' || s.intraReq || s.type === 'fund' || s.type === 'bond') return;
    s.intraReq = true;
    api('/intraday?symbol=' + s.sym).then(function (r) {
      if (r.v && r.v.length > 2) { s.intra = [s.prev].concat(r.v); s.intra[s.intra.length - 1] = s.price; s.intraReal = true; }
      if (SB.updateLive) SB.updateLive();
    }).catch(function () { /* the chart keeps the two points it has */ });
  };

  /* ---------- fundamentals (P/E, yield, market cap, 52-week range, volume) ---------- */
  const fundTried = {};
  function applyFund(k, f) {
    const s = SB.bySym[k]; if (!s || !f) return;
    const R = s.real = {};
    if (f.pe != null && f.pe > 0 && s.type === 'stock') { s.pe = f.pe; R.pe = true; }
    if (f.divYield != null && f.divYield >= 0) { s.div = f.divYield; R.div = true; }
    if (f.marketCapM != null && f.marketCapM > 0 && s.type === 'stock') { s.cap = f.marketCapM / 1000; R.cap = true; }
    if (f.high52 != null && f.low52 != null && f.high52 >= f.low52) { s.hi52 = f.high52; s.lo52 = f.low52; R.range = true; }
    if (f.avgVolM != null && f.avgVolM > 0) { s.avgVol = f.avgVolM * 1e6; R.vol = true; }
    if (f.industry) s.industry = f.industry;
  }
  // Loads one or a few symbols at a time (Finnhub's free plan allows ~60 calls a minute).
  feed.loadFundamentals = function (syms) {
    const want = (syms || []).filter(function (k) { const s = SB.bySym[k]; return s && s.src === 'real' && (s.type === 'stock' || s.type === 'etf') && !(fundTried[k] > Date.now()); });
    if (!want.length) return Promise.resolve();
    want.forEach(function (k) { fundTried[k] = Date.now() + 120000; });   // do not retry for 2 minutes
    const ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 25000);
    return fetch(base + '/fundamentals?symbols=' + want.join(','), { signal: ctl.signal, headers: { accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        clearTimeout(t);
        Object.keys(r.fundamentals || {}).forEach(function (k) { applyFund(k, r.fundamentals[k]); fundTried[k] = Date.now() + 6 * 3600e3; });
        if (SB.updateLive) SB.updateLive();
      }).catch(function () { clearTimeout(t); });
  };
  feed.ensureFundamentals = function (s) { if (s && !(fundTried[s.sym] > Date.now())) feed.loadFundamentals([s.sym]); };

  /* ---------- news ---------- */
  function toStory(n) {
    return { id: (SB.hash(n.url) % 900000000) + 1, ts: n.ts, cat: n.cat, sym: n.sym, title: n.title, body: n.summary ? [n.summary] : [], source: n.source, url: n.url, real: true };
  }
  feed.loadNews = function () {
    if (SB.dataMode !== 'real') return Promise.resolve();
    const st = SB.state(), syms = st.watch.slice(0, 4);
    const jobs = [api('/news')].concat(syms.map(function (s) { return api('/news?symbol=' + s).catch(function () { return { items: [] }; }); }));
    return Promise.all(jobs).then(function (rs) {
      const seen = {}, list = [];
      rs.forEach(function (r) { (r.items || []).forEach(function (n) { if (!seen[n.url]) { seen[n.url] = 1; list.push(toStory(n)); } }); });
      SB.news = list.sort(function (a, b) { return b.ts - a.ts; }).slice(0, 80); SB.newsError = !list.length;
      if (SB.updateLive) SB.updateLive(); rerenderSoft();
    }).catch(function () { SB.newsError = true; });
  };
  feed.symNews = function (sym) {
    const c = feed.symNewsCache[sym];
    if (c && Date.now() - c.at < 5 * 60000) return c.items;
    if (!c || !c.busy) {
      feed.symNewsCache[sym] = { at: c ? c.at : 0, items: c ? c.items : null, busy: true };
      api('/news?symbol=' + sym).then(function (r) { feed.symNewsCache[sym] = { at: Date.now(), items: (r.items || []).slice(0, 5).map(toStory) }; }, function () { feed.symNewsCache[sym] = { at: Date.now(), items: [] }; })
        .then(function () { if (SB.updateLive) SB.updateLive(); });
    }
    return c ? c.items : null;
  };

  /* ---------- "Explain this move" (OpenAI, server-side) ---------- */
  SB.acts['explain'] = function (el) {
    const out = document.getElementById('explain-out'), sym = el.dataset.sym; if (!out) return;
    el.disabled = true; out.innerHTML = '<p class="muted" role="status">Asking for a plain-English summary…</p>';
    api('/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbol: sym }) }).then(function (r) {
      out.innerHTML = '<p>' + esc(r.text) + '</p>' + ((r.basedOn || []).length ? '<p class="muted small">Based on: ' + r.basedOn.slice(0, 3).map(function (b) { return '<a href="' + esc(b.url) + '" target="_blank" rel="noopener noreferrer">' + esc(b.source || 'source') + '<span class="sr"> (opens in a new tab)</span></a>'; }).join(' · ') + '</p>' : '') + '<p class="muted small">AI-written from the price change and headlines above. It can be wrong and is not investment advice.</p>';
    }).catch(function () { out.innerHTML = '<p class="notice err" role="alert">The summary is not available right now. The AI service may not be set up on the backend.</p>'; })
      .then(function () { el.disabled = false; });
  };

  feed.start = function () { if (enabled) feed.refresh(); };
})();
