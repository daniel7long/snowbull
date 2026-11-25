/* SnowBall+ — pages for Investing, Retirement and Wealth Management menus. */
(function () {
  'use strict';
  const SB = window.SB, esc = SB.esc, money = SB.money, nf = SB.nf;
  const P = SB.pages, F = SB.frag, A = SB.acts, FM = SB.forms, IN = SB.inputs, CH = SB.changes;
  const st = function () { return SB.state(); };
  const rb = function () { return SB.resultBox(); };
  const thisYear = new Date().getFullYear();

  /* ================= Self-Directed Investing (research & screener) ================= */
  SB.ui.scr = { type: 'all', q: '', list: 'all' };
  F.screener = function () {
    const f = SB.ui.scr; let l = SB.securities.slice();
    if (f.type !== 'all') l = l.filter(function (s) { return s.type === f.type; });
    if (f.q) { const q = f.q.toLowerCase(); l = l.filter(function (s) { return (s.sym + ' ' + s.name + ' ' + s.sector).toLowerCase().indexOf(q) > -1; }); }
    const pc = function (s) { return SB.dayOf(s).pct; };
    if (f.list === 'gainers') l = l.slice().sort(function (a, b) { return pc(b) - pc(a); }).slice(0, 10);
    else if (f.list === 'decliners') l = l.slice().sort(function (a, b) { return pc(a) - pc(b); }).slice(0, 10);
    else if (f.list === 'income') l = l.filter(function (s) { return s.type === 'bond' ? s.coupon >= 4 : (s.div || 0) >= 2.5; });
    else if (f.list === 'lowcost') l = l.filter(function (s) { return s.exp != null && s.exp <= 0.05; });
    if (!l.length) return SB.empty('<p>No securities match these filters. Try clearing the search or choosing a different list.</p>');
    const stat = function (s) { return s.type === 'stock' ? 'P/E ' + s.pe + ' · Yield ' + nf(s.div, 2) + '%' : s.type === 'bond' ? 'YTM ' + nf(SB.ytm(s), 2) + '% · Coupon ' + nf(s.coupon, 2) + '%' : 'Expense ' + nf(s.exp, 3) + '% · Yield ' + nf(s.div, 2) + '%'; };
    return '<p class="muted small" role="status">' + l.length + ' result' + (l.length === 1 ? '' : 's') + '</p>' + SB.tableWrap('Securities', '<table class="tbl"><caption class="sr">Securities with last price, today’s change and key statistics</caption><thead><tr><th scope="col">Symbol</th><th scope="col">Type</th><th scope="col">Last</th><th scope="col">Today</th><th scope="col">Key statistics</th><th scope="col">Actions</th></tr></thead><tbody>' + l.map(function (s) {
      const w = st().watch.indexOf(s.sym) > -1;
      return '<tr><th scope="row">' + SB.symLink(s) + '<br><span class="muted small">' + esc(s.name) + '</span></th><td>' + SB.TYPE[s.type] + '<br><span class="muted small">' + esc(s.sector) + '</span></td><td class="num">' + SB.pxText(s) + '</td><td class="num">' + SB.quoteChg(s) + '</td><td class="small">' + stat(s) + '</td><td><button type="button" class="btn btn-sm btn-primary" data-act="trade-sym" data-sym="' + s.sym + '" data-side="buy">Buy<span class="sr"> ' + s.sym + '</span></button> <button type="button" class="btn btn-sm" data-act="watch" data-sym="' + s.sym + '" aria-pressed="' + w + '">' + (w ? 'Watching' : 'Watch') + '<span class="sr"> ' + s.sym + '</span></button></td></tr>';
    }).join('') + '</tbody></table>');
  };
  CH['scr-type'] = function (el) { SB.ui.scr.type = el.value; SB.updateLive(true); };
  IN['scr-q'] = function (el) { SB.ui.scr.q = el.value; SB.updateLive(true); };
  A['scr-list'] = function (el) { SB.ui.scr.list = el.dataset.v; SB.rerender(); };
  A['scr-go'] = function (el) { SB.ui.scr = { type: el.dataset.type, q: '', list: 'all' }; SB.go('self-directed'); };
  P['self-directed'] = function () {
    const f = SB.ui.scr;
    return SB.page('Self-Directed Investing', 'Research stocks, ETFs, mutual funds and bonds, build a watchlist, and place your own trades.', rb() +
      '<section class="card" aria-labelledby="sd1"><h2 id="sd1">Find investments</h2><div class="form-grid">' +
      SB.field({ id: 'sd-q', label: 'Search by name, symbol or category', type: 'search', value: f.q, attrs: ' data-input="scr-q" autocomplete="off"' }) +
      SB.field({ id: 'sd-type', label: 'Type', options: [['all', 'All types'], ['stock', 'Stocks'], ['etf', 'ETFs'], ['fund', 'Mutual funds'], ['bond', 'Bonds']], value: f.type, attrs: ' data-change="scr-type"' }) + '</div>' +
      SB.seg('scr-list', [['all', 'All'], ['gainers', 'Top gainers'], ['decliners', 'Top decliners'], ['income', 'Income'], ['lowcost', 'Low cost (≤0.05%)']], f.list, 'Quick lists') + '<div class="mt">' + SB.live('screener') + '</div></section>' +
      '<section class="card" aria-labelledby="sd2"><h2 id="sd2">Your watchlist</h2>' + SB.live('watchlist') + '</section>');
  };

  /* ================= Quote page & research ================= */
  SB.ui.qr = '1M';
  A['qr'] = function (el) { SB.ui.qr = el.dataset.v; SB.rerender(); };
  F.quotehead = function (sym) {
    const s = SB.bySym[sym]; if (!s) return '';
    const rd = SB.rangeData(s, SB.ui.qr), fmt = s.type === 'bond' ? function (v) { return nf(v, 2); } : function (v) { return money(v, v >= 1000 ? 0 : 2); };
    return '<p class="mt0">' + SB.feed.note(s) + '</p><p class="big-price">' + SB.pxText(s) + (s.type === 'bond' ? '<span class="muted small"> per $100 face</span>' : '') + '</p><p>' + SB.quoteChg(s) + ' <span class="muted small">today</span></p>' + SB.feed.historyNote(s) + SB.lineChart(rd.v, { title: s.name + ' price, ' + SB.ui.qr, labels: rd.labels, fmt: fmt });
  };
  F.quotestats = function (sym) {
    const s = SB.bySym[sym]; if (!s) return '';
    const real = SB.dataMode === 'real' && s.src === 'real', R = s.real || {};
    if (real && SB.feed && SB.feed.ensureFundamentals) SB.feed.ensureFundamentals(s);
    const est = function (ok, txt) { return real && !ok ? txt + ' <span class="muted small">(estimate)</span>' : txt; };
    let range = '—';
    if (real && R.range) range = money(s.lo52) + ' – ' + money(s.hi52);
    else if (!real || s.hsrc === 'real') {
      const L = s.hist.length, yr = s.hist.slice(L - 252), hi = Math.max.apply(null, yr), lo = Math.min.apply(null, yr);
      range = s.type === 'bond' ? nf(lo, 2) + ' – ' + nf(hi, 2) : money(lo) + ' – ' + money(hi);
    }
    const kv = [['Previous close', SB.pxText({ type: s.type, price: s.prev })], ['52-week range', range]];
    if (s.type === 'stock') {
      kv.push(['P/E ratio', est(R.pe, String(Math.round(s.pe * 10) / 10))], ['Dividend yield', est(R.div, nf(s.div, 2) + '%')], ['Market cap', est(R.cap, '$' + nf(s.cap, 0) + 'B')], ['Sector', s.sector]);
      if (real && s.industry) kv.push(['Industry', esc(s.industry)]);
    }
    if (s.type === 'etf' || s.type === 'fund') kv.push(['Expense ratio', est(false, nf(s.exp, 3) + '%')], ['Yield', est(R.div, nf(s.div, 2) + '%')], ['Category', s.sector]);
    if (s.type === 'bond') kv.push(['Coupon', nf(s.coupon, 2) + '%'], ['Yield to maturity', nf(SB.ytm(s), 2) + '%'], ['Maturity', s.years < 1 ? Math.round(s.years * 12) + ' months' : s.years + ' years'], ['Credit rating', s.rating], ['Face value', '$1,000 per bond']);
    if (s.avgVol) kv.push(['Average volume', nf(s.avgVol / 1e6, 1) + 'M']);
    return '<dl class="kv">' + kv.map(function (k) { return '<dt>' + k[0] + '</dt><dd>' + k[1] + '</dd>'; }).join('') + '</dl>' +
      (real && (s.type === 'stock' || s.type === 'etf') ? '<p class="muted small">Statistics come from Finnhub when available. “Estimate” marks a built-in approximate value.</p>' : '');
  };
  F.symnews = function (sym) {
    if (SB.dataMode === 'real') {
      const items = SB.feed.symNews(sym);
      if (items === null) return '<p class="muted" role="status">Loading news…</p>';
      return items.length ? '<ul class="plain news-list">' + items.map(SB.newsItem).join('') + '</ul>' : '<p class="muted">No recent stories about this security. Check <a href="#news">all news</a>.</p>';
    }
    const l = SB.news.filter(function (n) { return n.sym === sym; }).slice(0, 3);
    return l.length ? '<ul class="plain news-list">' + l.map(SB.newsItem).join('') + '</ul>' : '<p class="muted">No stories about this security yet. Check <a href="#news">all news</a>.</p>';
  };
  P.quote = function (sym) {
    sym = String(sym || '').toUpperCase(); const s = SB.bySym[sym];
    if (!s) return SB.page('Symbol not found', '', SB.empty('<p>We could not find “' + esc(sym) + '”.</p><p><a class="btn btn-primary" href="#self-directed">Browse investments</a></p>'));
    const held = st().accounts.filter(function (a) { return a.positions[sym]; }), w = st().watch.indexOf(sym) > -1, news = SB.news.filter(function (n) { return n.sym === sym; }).slice(0, 3);
    return SB.page(s.name, SB.badge(SB.TYPE[s.type]) + ' <strong>' + s.sym + '</strong> · ' + esc(s.desc),
      rb() + '<div class="card row wrap"><button type="button" class="btn btn-accent" data-act="trade-sym" data-sym="' + sym + '" data-side="buy">Buy</button><button type="button" class="btn" data-act="trade-sym" data-sym="' + sym + '" data-side="sell">Sell</button><button type="button" class="btn btn-ghost" data-act="watch" data-sym="' + sym + '" aria-pressed="' + w + '">' + (w ? '★ On your watchlist' : '☆ Add to watchlist') + '</button></div>' +
      '<div class="grid g2-1"><section class="card" aria-labelledby="q1"><h2 id="q1" class="sr">Price</h2>' + SB.seg('qr', [['1D', '1 day'], ['1M', '1 month'], ['3M', '3 months'], ['6M', '6 months'], ['1Y', '1 year']], SB.ui.qr, 'Chart time range') + SB.live('quotehead', sym) + '</section>' +
      '<div class="stack"><section class="card" aria-labelledby="q2"><h2 id="q2">Key statistics</h2>' + SB.live('quotestats', sym) + '</section>' +
      '<section class="card" aria-labelledby="q3"><h2 id="q3">Your position</h2>' + (held.length ? '<ul class="plain">' + held.map(function (a) { const p = a.positions[sym]; return '<li class="row between"><span>' + esc(a.name) + '</span><span>' + SB.qty(p.qty) + ' · ' + money(p.qty * SB.unit(s)) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">You do not own this security.</p>') + '</section></div></div>' +
      (SB.dataMode === 'real' && s.src === 'real' ? '<section class="card" aria-labelledby="q5"><h2 id="q5">What moved this price?</h2><p class="muted small">A short AI summary written only from the price change and the headlines below.</p><button type="button" class="btn" data-act="explain" data-sym="' + sym + '">Explain this move</button><div id="explain-out" aria-live="polite" class="mt"></div></section>' : '') +
      '<section class="card" aria-labelledby="q4"><h2 id="q4">Related news</h2>' + SB.live('symnews', sym) + '</section>');
  };
  P.research = function () {
    const q = SB.ui.q || '', r = SB.search(q);
    return SB.page('Search results', 'Results for “' + esc(q) + '”.', r.length ? SB.tableWrap('Search results', '<table class="tbl"><caption class="sr">Search results</caption><thead><tr><th scope="col">Symbol</th><th scope="col">Type</th><th scope="col">Last</th><th scope="col">Today</th></tr></thead><tbody>' + r.map(function (s) { return '<tr><th scope="row">' + SB.symLink(s) + '<br><span class="muted small">' + esc(s.name) + '</span></th><td>' + SB.TYPE[s.type] + '</td><td class="num">' + SB.pxText(s) + '</td><td class="num">' + SB.quoteChg(s) + '</td></tr>'; }).join('') + '</tbody></table>') : SB.empty('<p>No matches. Try a ticker like AAPL, or a word like “bond” or “dividend”.</p>'));
  };

  /* ================= Advanced Trading ================= */
  P['advanced-trading'] = function () {
    const a = SB.acct();
    return SB.page('Advanced Trading', 'Use stop and stop-limit orders to manage risk, and size positions with the risk calculator.', rb() + SB.ticket(true) +
      '<form class="card" data-form="risk" data-init="risk" aria-labelledby="ad1"><h2 id="ad1">Position-size calculator</h2><p class="muted">Decide how many shares to buy so a stop-out costs only the amount you are willing to lose.</p><div class="form-grid">' +
      SB.field({ id: 'rk-acct', name: 'acct', label: 'Account size (USD)', type: 'number', value: Math.round(SB.acctValue(a)), attrs: ' min="0" step="1"' }) +
      SB.field({ id: 'rk-risk', name: 'risk', label: 'Risk per trade (%)', type: 'number', value: '1', attrs: ' min="0.1" max="10" step="0.1"' }) +
      SB.field({ id: 'rk-entry', name: 'entry', label: 'Entry price', type: 'number', value: '100', attrs: ' min="0" step="0.01"' }) +
      SB.field({ id: 'rk-stop', name: 'stop', label: 'Stop price', type: 'number', value: '95', attrs: ' min="0" step="0.01"' }) +
      SB.field({ id: 'rk-target', name: 'target', label: 'Target price', type: 'number', value: '112', attrs: ' min="0" step="0.01"' }) + '</div><div data-risk-out aria-live="polite"></div></form>' +
      '<section class="card" aria-labelledby="ad2"><h2 id="ad2">Order types at a glance</h2><div class="grid g2">' +
      [['Market', 'Fills right away at the current price. Best when speed matters more than price.'], ['Limit', 'Buy at or below, or sell at or above, a price you set. It may never fill.'], ['Stop', 'Becomes a market order once the price touches your stop. Often used to limit a loss.'], ['Stop-limit', 'Becomes a limit order once the stop is touched, so you control the price but may miss the exit in a fast market.']].map(function (o) { return '<div><h3>' + o[0] + '</h3><p>' + o[1] + '</p></div>'; }).join('') + '</div></section>' +
      '<section class="card" aria-labelledby="ad3"><h2 id="ad3">Open orders</h2>' + SB.live('orders', 'all') + '</section>');
  };
  SB.inits.risk = function (f) {
    const g = function (n) { return +f.elements[n].value || 0; }, out = f.querySelector('[data-risk-out]');
    const acct = g('acct'), risk = g('risk'), entry = g('entry'), stop = g('stop'), target = g('target');
    if (!(entry > 0) || !(stop > 0) || entry <= stop) { out.innerHTML = SB.notice('Enter a stop price below your entry price (for a long position).', 'info'); return; }
    const per = entry - stop, maxLoss = acct * risk / 100, sh = Math.floor(maxLoss / per), cost = sh * entry, rr = target > entry ? (target - entry) / per : 0;
    out.innerHTML = '<div class="grid g4">' + SB.tile('Shares to buy', nf(sh, 0)) + SB.tile('Position cost', money(cost), nf(acct ? cost / acct * 100 : 0, 1) + '% of account') + SB.tile('Loss if stopped', money(sh * per), 'Limit ' + money(maxLoss)) + SB.tile('Reward : risk', rr ? nf(rr, 2) + ' : 1' : '—', rr ? 'Gain if target hit ' + money(sh * (target - entry)) : 'Set a target above entry') + '</div>';
  };
  IN['risk'] = function (el) { SB.inits.risk(el.form); };
  FM['risk'] = function () { };

  /* ================= Account opening ================= */
  A['open-acct'] = function (el) {
    const t = el.dataset.type; if (t === 'custodial') { SB.go('investing-child'); return; }
    const r = SB.openAccount(t); if (r.ok) SB.ui.pf = r.acct.id; SB.buildAcctSwitch(); SB.success(r);
  };

  /* ================= Investing for a Child ================= */
  P['investing-child'] = function () {
    const kids = st().accounts.filter(function (a) { return a.type === 'custodial'; });
    const cur = kids.find(function (a) { return a.id === SB.ui.kid; }) || kids[0];
    let proj = '';
    if (cur) {
      const yrs = Math.max(1, 18 - (thisYear - cur.child.born));
      proj = '<form class="card" data-form="childproj" data-init="childproj" data-years="' + yrs + '" aria-labelledby="ch3"><h2 id="ch3">Growth projection for ' + esc(cur.child.name) + '</h2>' + (kids.length > 1 ? SB.field({ id: 'ch-sel', label: 'Child account', options: kids.map(function (k) { return [k.id, k.name]; }), value: cur.id, attrs: ' data-change="kid-sel"' }) : '') +
        '<p class="muted">' + yrs + ' year' + (yrs === 1 ? '' : 's') + ' until age 18 (born ' + cur.child.born + ').</p><div class="form-grid">' +
        SB.field({ id: 'cp-start', name: 'start', label: 'Starting balance (USD)', type: 'number', value: Math.round(SB.acctValue(cur)), attrs: ' min="0" step="1"' }) +
        SB.field({ id: 'cp-mo', name: 'monthly', label: 'Monthly contribution (USD)', type: 'number', value: '100', attrs: ' min="0" step="10"' }) +
        SB.field({ id: 'cp-ret', name: 'ret', label: 'Assumed yearly return (%)', type: 'number', value: '6', attrs: ' min="0" max="15" step="0.5"', hint: 'Returns are never guaranteed.' }) + '</div><div data-child-out aria-live="polite"></div></form>';
    }
    return SB.page('Investing for a Child', 'Open a custodial account (UTMA) to practice saving for a child’s future. In real life, an adult manages the account until the child reaches the age of majority.', rb() +
      (cur ? '<section class="card" aria-labelledby="ch1"><h2 id="ch1">Your custodial accounts</h2>' + SB.tableWrap('Custodial accounts', '<table class="tbl"><caption class="sr">Custodial accounts</caption><thead><tr><th scope="col">Account</th><th scope="col">Child</th><th scope="col">Value</th><th scope="col">Action</th></tr></thead><tbody>' + kids.map(function (k) { return '<tr><th scope="row">' + esc(k.name) + '<br><span class="muted small">' + k.num + '</span></th><td>' + esc(k.child.name) + ' (born ' + k.child.born + ')</td><td class="num">' + money(SB.acctValue(k)) + '</td><td><button class="btn btn-sm" type="button" data-act="trade-acct" data-acct="' + k.id + '">Invest<span class="sr"> in ' + esc(k.name) + '</span></button></td></tr>'; }).join('') + '</tbody></table>') + '</section>' + proj : '') +
      '<form class="card" data-form="custodial" novalidate aria-labelledby="ch2"><h2 id="ch2">Open a custodial account</h2><div class="form-grid">' + SB.field({ id: 'co-name', name: 'child', label: 'Child’s first name', attrs: ' maxlength="30" required' }) + SB.field({ id: 'co-born', name: 'born', label: 'Child’s birth year', type: 'number', value: thisYear - 5, attrs: ' min="' + (thisYear - 17) + '" max="' + thisYear + '" required' }) + SB.field({ id: 'co-fund', name: 'fund', label: 'Opening deposit from checking (optional)', type: 'number', attrs: ' min="0" step="1"' }) + '</div><div class="form-err notice err" role="alert" hidden></div><button class="btn btn-accent" type="submit">Open account</button></form>' +
      '<section class="card" aria-labelledby="ch4"><h2 id="ch4">Ideas for long-term savers</h2><p>Broad, low-cost funds are a popular starting point for long horizons. Explore <a href="#quote-FZROX">FZROX</a>, <a href="#quote-VTI">VTI</a> or <a href="#quote-FXAIX">FXAIX</a>, or use the <a href="#investment-management">portfolio builder</a>.</p></section>');
  };
  A['trade-acct'] = function (el) { SB.ui.prefill = { acct: el.dataset.acct }; SB.go('trade'); };
  CH['kid-sel'] = function (el) { SB.ui.kid = el.value; SB.rerender(); };
  FM['custodial'] = function (f) {
    SB.clearErr(f); const d = SB.fd(f), born = Math.round(+d.born);
    if (!(d.child || '').trim()) { SB.fail(f, 'Enter the child’s first name.'); return; } if (!(born >= thisYear - 17 && born <= thisYear)) { SB.fail(f, 'Enter a birth year within the last 17 years.'); return; }
    const r = SB.openAccount('custodial', { child: d.child.trim(), born: born }); if (!r.ok) { SB.fail(f, r.msg); return; }
    SB.ui.kid = r.acct.id; SB.buildAcctSwitch();
    if (+d.fund > 0) SB.transfer({ from: 'bank', to: r.acct.id, amount: d.fund });
    SB.success(r);
  };
  SB.inits.childproj = function (f) {
    const g = function (n) { return +f.elements[n].value || 0; }, yrs = +f.dataset.years, r = g('ret') / 100, mo = g('monthly'); let bal = g('start'); const vals = [bal];
    for (let i = 0; i < yrs; i++) { bal = bal * (1 + r) + mo * 12 * (1 + r / 2); vals.push(bal); }
    const put = g('start') + mo * 12 * yrs;
    f.querySelector('[data-child-out]').innerHTML = '<div class="grid g3">' + SB.tile('Projected at 18', money(bal, 0)) + SB.tile('You contribute', money(put, 0)) + SB.tile('Growth', money(bal - put, 0)) + '</div>' + SB.lineChart(vals, { title: 'Projected balance until age 18', labels: ['Today', 'Year ' + Math.round(yrs / 2), 'Age 18'] });
  };
  IN['childproj'] = function (el) { SB.inits.childproj(el.form); };
  FM['childproj'] = function () { };

  /* ================= Managing Cash & Credit ================= */
  P['cash-credit'] = function () {
    return SB.page('Managing Cash & Credit', 'Understand where your cash can earn interest — and what borrowing against your investments really costs.', rb() +
      '<section class="card" aria-labelledby="cc1"><h2 id="cc1">Cash options</h2>' + SB.tableWrap('Cash options', '<table class="tbl"><caption class="sr">Comparison of cash options</caption><thead><tr><th scope="col">Option</th><th scope="col">Simulated yield</th><th scope="col">Good to know</th></tr></thead><tbody><tr><th scope="row">' + SB.MM.name + ' (SNMM)</th><td class="num">' + SB.pct(SB.MM.yield) + '</td><td>Invests in short-term government debt. Expense ratio ' + SB.pct(SB.MM.exp) + '. Not insured; the fund aims to hold a steady $1 price.</td></tr><tr><th scope="row">Insured bank deposit sweep</th><td class="num">' + SB.pct(SB.RATES.bank) + '</td><td>Deposits at partner banks, with insurance limits. Lower yield, higher protection.</td></tr><tr><th scope="row">Treasury bills</th><td class="num">' + nf(SB.ytm(SB.bySym.TBILL3M), 2) + '%</td><td>Buy <a href="#quote-TBILL3M">3-month T-bills</a> to lock in a rate until maturity.</td></tr></tbody></table>') + '<p><a class="btn" href="#cash">Choose a sweep option</a></p></section>' +
      '<form class="card" data-form="margin" data-init="margin" aria-labelledby="cc2"><h2 id="cc2">Margin loan calculator</h2><p class="muted">Margin means borrowing against your holdings. It magnifies gains <em>and</em> losses. This calculator is educational; SnowBall+ does not lend money.</p><div class="form-grid">' +
      SB.field({ id: 'mg-val', name: 'value', label: 'Your investments (USD)', type: 'number', value: '10000', attrs: ' min="0" step="100"' }) + SB.field({ id: 'mg-loan', name: 'loan', label: 'Amount borrowed (USD)', type: 'number', value: '5000', attrs: ' min="0" step="100"' }) +
      SB.field({ id: 'mg-rate', name: 'rate', label: 'Interest rate (%)', type: 'number', value: SB.RATES.margin, attrs: ' min="0" step="0.1"' }) + SB.field({ id: 'mg-drop', name: 'drop', label: 'If markets fall by (%)', type: 'number', value: '30', attrs: ' min="0" max="90" step="1"' }) + '</div><div data-margin-out aria-live="polite"></div></form>');
  };
  SB.inits.margin = function (f) {
    const g = function (n) { return +f.elements[n].value || 0; }, v = g('value'), loan = g('loan'), rate = g('rate'), drop = g('drop');
    const eq = v - loan, afterV = v * (1 - drop / 100), afterEq = afterV - loan, pctEq = afterV > 0 ? afterEq / afterV * 100 : 0;
    const call = afterV > 0 && pctEq < 30;
    f.querySelector('[data-margin-out]').innerHTML = '<div class="grid g4">' + SB.tile('Your equity today', money(eq, 0)) + SB.tile('Interest per year', money(loan * rate / 100, 0), money(loan * rate / 1200, 0) + ' per month') + SB.tile('Equity after the drop', money(afterEq, 0), nf(eq ? (afterEq / eq - 1) * 100 : 0, 0) + '% vs. today') + SB.tile('Equity ratio after drop', nf(pctEq, 1) + '%', 'Simulated minimum: 30%') + '</div>' +
      (loan > v ? SB.notice('Borrowing more than the value of your investments is not allowed.', 'err') : call ? SB.notice('<strong>Margin call risk:</strong> your equity ratio would fall below the simulated 30% minimum. In real accounts, a broker may force you to sell holdings or add cash.', 'warn') : SB.notice('Your equity ratio stays above the simulated 30% minimum in this scenario, but real markets can move faster and further.', 'info'));
  };
  IN['margin'] = function (el) { SB.inits.margin(el.form); };
  FM['margin'] = function () { };

  /* ================= Investment Accounts & Products ================= */
  P.products = function () {
    const types = [['brokerage', 'Individual brokerage', 'A flexible, taxable account for any goal. Deposit and withdraw anytime.'], ['roth', 'Roth IRA', 'Retirement account funded with after-tax dollars. Qualified withdrawals are generally tax-free.'], ['trad', 'Traditional IRA', 'Retirement account that may offer a tax deduction now; withdrawals are generally taxed later.'], ['custodial', 'Custodial account (UTMA)', 'An account managed by an adult for a child.']];
    const cnt = function (t) { return SB.securities.filter(function (s) { return s.type === t; }).length; };
    return SB.page('Investment Accounts & Products', 'Choose an account that fits your goal, then explore what you can invest in.', rb() +
      '<div class="grid g2">' + types.map(function (t) { const n = st().accounts.filter(function (a) { return a.type === t[0]; }).length; return '<section class="card" aria-labelledby="ac-' + t[0] + '"><h2 id="ac-' + t[0] + '">' + t[1] + '</h2><p>' + t[2] + '</p><p class="muted small">You have ' + n + ' of this type.</p><button type="button" class="btn btn-primary" data-act="open-acct" data-type="' + t[0] + '">' + (t[0] === 'custodial' ? 'Set up a custodial account' : 'Open a ' + t[1]) + '</button></section>'; }).join('') + '</div>' +
      '<section class="card" aria-labelledby="pr1"><h2 id="pr1">What you can invest in</h2>' + SB.tableWrap('Products', '<table class="tbl"><caption class="sr">Products available in SnowBall+</caption><thead><tr><th scope="col">Product</th><th scope="col">Available</th><th scope="col">Trading cost</th><th scope="col">Browse</th></tr></thead><tbody>' +
        [['Stocks', 'stock', '$0 commission'], ['ETFs', 'etf', '$0 commission'], ['Mutual funds', 'fund', '$0 transaction fee (simulated)'], ['Bonds & Treasuries', 'bond', '$0 commission (simulated)']].map(function (r) { return '<tr><th scope="row">' + r[0] + '</th><td class="num">' + cnt(r[1]) + '</td><td>' + r[2] + '</td><td><button type="button" class="btn btn-sm" data-act="scr-go" data-type="' + r[1] + '">View ' + r[0].toLowerCase() + '</button></td></tr>'; }).join('') + '<tr><th scope="row">Money market fund</th><td class="num">1</td><td>$0</td><td><a class="btn btn-sm" href="#cash">Cash sweep</a></td></tr></tbody></table>') + '</section>');
  };

  /* ================= Education ================= */
  function lessons(key) {
    const edu = st().prefs.edu;
    return SB.LESSONS[key].map(function (l) {
      return '<details class="lesson"><summary><span>' + esc(l.title) + '</span> <span class="muted small" data-lesson-status="' + l.id + '">' + l.mins + ' min' + (edu[l.id] ? ' · ✓ completed' : '') + '</span></summary><div class="lesson-body">' + l.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
        '<form data-form="quiz" data-lesson="' + l.id + '" data-key="' + key + '" novalidate>' + SB.radios('a-' + l.id, l.quiz.o.map(function (o, i) { return [i, esc(o)]; }), '', 'Check yourself: ' + esc(l.quiz.q)) + '<button class="btn btn-sm" type="submit">Check answer</button><div class="quiz-out" role="status"></div></form></div></details>';
    }).join('');
  }
  function progress(key) { const edu = st().prefs.edu, ls = SB.LESSONS[key]; const n = ls.filter(function (l) { return edu[l.id]; }).length; return n + ' of ' + ls.length + ' lessons completed'; }
  FM['quiz'] = function (f) {
    const l = SB.LESSONS[f.dataset.key].find(function (x) { return x.id === f.dataset.lesson; }), out = f.querySelector('.quiz-out'), v = f.elements['a-' + l.id].value;
    if (v === '') { out.innerHTML = '<p class="warn-text">Choose an answer first.</p>'; return; }
    if (+v === l.quiz.a) { out.innerHTML = '<p class="ok-text">✓ Correct. ' + esc(l.quiz.why) + '</p>'; st().prefs.edu[l.id] = true; SB.save(); const sp = document.querySelector('[data-lesson-status="' + l.id + '"]'); if (sp) sp.textContent = l.mins + ' min · ✓ completed'; const pr = document.getElementById('edu-progress'); if (pr) pr.textContent = progress(f.dataset.key); }
    else out.innerHTML = '<p class="warn-text">Not quite. ' + esc(l.quiz.why) + '</p>';
  };
  P.education = function () {
    return SB.page('Investing & Trading Education', 'Short lessons with a quick check at the end of each one.', '<p class="notice info" id="edu-progress" role="status">' + progress('invest') + '</p><div class="card">' + lessons('invest') + '</div>' +
      '<section class="card" aria-labelledby="ed2"><h2 id="ed2">Glossary</h2><dl class="kv wide">' + SB.GLOSSARY.map(function (g) { return '<dt>' + g[0] + '</dt><dd>' + g[1] + '</dd>'; }).join('') + '</dl></section>');
  };

  /* ================= Retirement ================= */
  P['retirement-planning'] = function () {
    const val = Math.round(SB.sumValue(st().accounts) / 1000) * 1000;
    return SB.page('Retirement Planning', 'Estimate whether your savings could support the retirement you want. Results are projections, not promises.', rb() +
      '<form class="card" data-form="rp" data-init="rp" aria-labelledby="rp1"><h2 id="rp1">Your assumptions</h2><div class="form-grid">' +
      SB.field({ id: 'rp-age', name: 'age', label: 'Current age', type: 'number', value: '30', attrs: ' min="18" max="80"' }) + SB.field({ id: 'rp-ret', name: 'retire', label: 'Retirement age', type: 'number', value: '65', attrs: ' min="40" max="85"' }) +
      SB.field({ id: 'rp-sav', name: 'saved', label: 'Current retirement savings (USD)', type: 'number', value: val, attrs: ' min="0" step="1000"' }) + SB.field({ id: 'rp-mo', name: 'monthly', label: 'Monthly contribution (USD)', type: 'number', value: '500', attrs: ' min="0" step="50"' }) +
      SB.field({ id: 'rp-r', name: 'ret', label: 'Yearly return (%)', type: 'number', value: '6.5', attrs: ' min="0" max="15" step="0.1"' }) + SB.field({ id: 'rp-inf', name: 'inf', label: 'Yearly inflation (%)', type: 'number', value: '2.5', attrs: ' min="0" max="10" step="0.1"' }) +
      SB.field({ id: 'rp-inc', name: 'income', label: 'Yearly income wanted, in today’s dollars', type: 'number', value: '60000', attrs: ' min="0" step="1000"' }) + '</div></form><div data-rp-out aria-live="polite"></div>');
  };
  SB.inits.rp = function (f) {
    const g = function (n) { return +f.elements[n].value || 0; }, age = g('age'), ret = g('retire'), n = ret - age, out = document.querySelector('[data-rp-out]');
    if (!out) return;
    if (n < 1) { out.innerHTML = SB.notice('Retirement age must be after your current age.', 'err'); return; }
    const r = g('ret') / 100, inf = g('inf') / 100, mo = g('monthly'); let bal = g('saved'); const vals = [bal];
    for (let i = 0; i < n; i++) { bal = bal * (1 + r) + mo * 12 * (1 + r / 2); vals.push(bal); }
    const real = bal / Math.pow(1 + inf, n), income = real * 0.04, want = g('income'), gap = want - income;
    const rr = (1 + r) / (1 + inf) - 1, need = want / 0.04, g0 = g('saved') * Math.pow(1 + rr, n);
    let extra = 0; if (gap > 0) { const fvf = rr === 0 ? n * 12 : (Math.pow(1 + rr, n) - 1) / rr * 12; extra = Math.max(0, (need - g0) / fvf); }
    out.innerHTML = '<section class="card" aria-labelledby="rp2"><h2 id="rp2">Projection</h2><div class="grid g4">' + SB.tile('Balance at ' + ret, money(bal, 0), 'About ' + money(real, 0) + ' in today’s dollars') + SB.tile('Sustainable income', money(income, 0) + '/yr', 'Using a 4% first-year withdrawal') + SB.tile('Income wanted', money(want, 0) + '/yr') + SB.tile(gap > 0 ? 'Shortfall' : 'Surplus', money(Math.abs(gap), 0) + '/yr') + '</div>' +
      (gap > 0 ? SB.notice('<strong>You may fall short.</strong> To reach your goal under these assumptions, you would need to save about <strong>' + money(extra, 0) + ' per month</strong> (instead of ' + money(mo, 0) + '), retire later, or plan for lower spending.', 'warn') : SB.notice('<strong>On track.</strong> Under these assumptions, your savings could support your target income. Markets vary, so revisit your plan regularly.', 'ok')) +
      SB.lineChart(vals, { title: 'Projected balance from age ' + age + ' to ' + ret, labels: ['Age ' + age, 'Age ' + Math.round((age + ret) / 2), 'Age ' + ret] }) + '<p class="muted small">Simplified model with a constant return and inflation. It ignores taxes, Social Security and changing contributions.</p></section>';
  };
  IN['rp'] = function (el) { SB.inits.rp(el.form); };
  FM['rp'] = function () { };

  P['retirement-accounts'] = function () {
    const iras = st().accounts.filter(SB.isIRA);
    return SB.page('Retirement Accounts', 'Open an IRA, track your yearly contributions and compare Roth and Traditional.', rb() +
      '<div class="row wrap card"><button type="button" class="btn btn-primary" data-act="open-acct" data-type="roth">Open a Roth IRA</button><button type="button" class="btn btn-primary" data-act="open-acct" data-type="trad">Open a Traditional IRA</button></div>' +
      (iras.length ? '<div class="grid g2">' + iras.map(function (a) { const c = a.contribYear === thisYear ? a.contrib : 0; return '<section class="card" aria-labelledby="ra-' + a.id + '"><h2 id="ra-' + a.id + '">' + esc(a.name) + '</h2><div class="grid g2">' + SB.tile('Value', money(SB.acctValue(a))) + SB.tile('Cash', money(a.cash)) + '</div><p class="small">Contributions this year: ' + money(c, 0) + ' of ' + money(SB.IRA_LIMIT, 0) + ' (simulated limit)</p>' + SB.meter(c, SB.IRA_LIMIT, 'IRA contribution progress') + '<div class="row wrap mt"><a class="btn" href="#transfers">Add money</a><button type="button" class="btn" data-act="trade-acct" data-acct="' + a.id + '">Invest</button></div></section>'; }).join('') + '</div>' : SB.empty('<p>You do not have an IRA yet. Open one above to get started.</p>')) +
      '<section class="card" aria-labelledby="ra2"><h2 id="ra2">Roth vs. Traditional</h2>' + SB.tableWrap('Roth versus Traditional IRA', '<table class="tbl"><caption class="sr">Roth IRA compared with Traditional IRA</caption><thead><tr><th scope="col">Feature</th><th scope="col">Roth IRA</th><th scope="col">Traditional IRA</th></tr></thead><tbody><tr><th scope="row">Contributions</th><td>After-tax</td><td>May be tax-deductible</td></tr><tr><th scope="row">Growth</th><td>Tax-free</td><td>Tax-deferred</td></tr><tr><th scope="row">Qualified withdrawals</th><td>Generally tax-free</td><td>Taxed as ordinary income</td></tr><tr><th scope="row">Required minimum distributions</th><td>None for the original owner</td><td>Yes, starting at a set age</td></tr></tbody></table>') + '<p class="muted small">General information only. Limits and eligibility rules change; confirm details at irs.gov or with a tax professional.</p></section>');
  };
  P['retirement-education'] = function () { return SB.page('Retirement Education', 'Learn how retirement accounts, withdrawals and risk fit together.', '<p class="notice info" id="edu-progress" role="status">' + progress('retire') + '</p><div class="card">' + lessons('retire') + '</div>'); };

  /* ================= Wealth Management ================= */
  P['wealth-offerings'] = function () {
    const tiers = [['Self-Directed', 'You choose and place every trade.', 0, 'None', ['$0 commissions', 'Research, screener and watchlists', 'Education library']], ['Guided Portfolios', 'Answer a questionnaire and invest in a model portfolio.', 0.35, '$0 (simulated)', ['Risk questionnaire', 'Model portfolios', 'Portfolio builder with one-click investing']], ['Advisor-Led', 'Work one-on-one with a planner who builds and monitors a plan.', 0.85, '$250,000 (simulated)', ['Dedicated planner', 'Tax-aware strategy', 'Regular reviews']]];
    return SB.page('Wealth Management Offerings', 'Pick the level of help that fits you. Fees shown are fictional and used for practice.', rb() + '<div class="grid g3">' + tiers.map(function (t, i) { return '<section class="card" aria-labelledby="wo' + i + '"><h2 id="wo' + i + '">' + t[0] + '</h2><p>' + t[1] + '</p><p class="big">' + (t[2] ? nf(t[2], 2) + '% <span class="small muted">per year</span>' : 'No advisory fee') + '</p><p class="small muted">Minimum: ' + t[3] + '</p><ul>' + t[4].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></section>'; }).join('') + '</div>' +
      '<form class="card" data-form="fee" data-init="fee" aria-labelledby="wo9"><h2 id="wo9">Fee calculator</h2>' + SB.field({ id: 'fee-v', name: 'v', label: 'Amount invested (USD)', type: 'number', value: Math.round(SB.sumValue(st().accounts)), attrs: ' min="0" step="1000"' }) + '<div data-fee-out aria-live="polite"></div></form>' +
      '<div class="row wrap"><a class="btn btn-primary" href="#investment-management">Try Guided Portfolios</a><a class="btn" href="#advisors">Meet advisors</a></div>');
  };
  SB.inits.fee = function (f) {
    const v = +f.elements.v.value || 0;
    f.querySelector('[data-fee-out]').innerHTML = SB.tableWrap('Fees', '<table class="tbl"><caption class="sr">Estimated yearly advisory fee</caption><thead><tr><th scope="col">Tier</th><th scope="col">Yearly fee</th><th scope="col">Over 10 years*</th></tr></thead><tbody>' + [['Self-Directed', 0], ['Guided Portfolios', 0.35], ['Advisor-Led', 0.85]].map(function (t) { return '<tr><th scope="row">' + t[0] + '</th><td class="num">' + money(v * t[1] / 100, 0) + '</td><td class="num">' + money(v * (Math.pow(1.06, 10) - Math.pow(1.06 - t[1] / 100, 10)), 0) + '</td></tr>'; }).join('') + '</tbody></table><p class="muted small">*Estimated drag on a 6% yearly return, simulated.</p>');
  };
  IN['fee'] = function (el) { SB.inits.fee(el.form); };
  FM['fee'] = function () { };

  P.advisors = function () {
    const m = st().meetings;
    return SB.page('Financial Advisors', 'Meet the fictional planners of the SnowBall+ simulator and request a practice meeting. No real person is contacted.', rb() + '<div class="grid g3">' + SB.ADVISORS.map(function (a) { return '<section class="card" aria-labelledby="' + a.id + '"><h2 id="' + a.id + '">' + esc(a.name) + '</h2><p><strong>' + esc(a.role) + '</strong></p><p>' + esc(a.note) + '</p><p class="muted small">Available: ' + esc(a.slots) + '</p></section>'; }).join('') + '</div>' +
      '<div class="grid g2"><form class="card" data-form="meeting" novalidate aria-labelledby="am1"><h2 id="am1">Request a meeting</h2>' + SB.field({ id: 'am-ad', name: 'advisor', label: 'Advisor', options: SB.ADVISORS.map(function (a) { return [a.name, a.name + ' — ' + a.role]; }) }) + SB.field({ id: 'am-topic', name: 'topic', label: 'What would you like to discuss?', options: ['Starting to invest', 'Retirement planning', 'Saving for a child', 'Taxes and accounts', 'Building a portfolio'] }) + SB.field({ id: 'am-date', name: 'date', label: 'Preferred date', type: 'date', attrs: ' min="' + SB.todayStr() + '" required' }) + '<div class="form-err notice err" role="alert" hidden></div><button type="submit" class="btn btn-accent">Request meeting</button></form>' +
      '<section class="card" aria-labelledby="am2"><h2 id="am2">Your requests</h2>' + (m.length ? '<ul class="plain">' + m.map(function (x) { return '<li class="row between"><span>' + esc(x.advisor) + ' · ' + esc(x.topic) + '<br><span class="muted small">' + esc(x.date) + ' · Requested (simulated)</span></span><button type="button" class="btn btn-sm" data-act="rm-meeting" data-id="' + x.id + '">Cancel<span class="sr"> request with ' + esc(x.advisor) + '</span></button></li>'; }).join('') + '</ul>' : '<p class="muted">No requests yet.</p>') + '</section></div>');
  };
  FM['meeting'] = function (f) { SB.clearErr(f); const d = SB.fd(f); if (!d.date) { SB.fail(f, 'Choose a preferred date.'); return; } if (d.date < SB.todayStr()) { SB.fail(f, 'Choose a date that is today or later.'); return; } st().meetings.unshift({ id: SB.uid('m'), advisor: d.advisor, topic: d.topic, date: d.date }); SB.save(); SB.success({ ok: true, msg: 'Meeting requested with ' + d.advisor + ' for ' + d.date + '. This is a simulation; nobody was contacted.' }); };
  A['rm-meeting'] = function (el) { const s = st(); s.meetings = s.meetings.filter(function (x) { return x.id !== el.dataset.id; }); SB.save(); SB.rerender(); };

  P['financial-planning'] = function () {
    const goals = st().goals, R = 0.05;
    const cards = goals.map(function (g) {
      const n = Math.max(0.5, g.year - thisYear), gr = Math.pow(1 + R, n), fv = g.saved * gr + g.monthly * 12 * (gr - 1) / R, pct = g.target ? fv / g.target * 100 : 0, need = Math.max(0, (g.target - g.saved * gr) * R / (gr - 1) / 12);
      return '<section class="card" aria-labelledby="g-' + g.id + '"><div class="row between"><h2 id="g-' + g.id + '">' + esc(g.name) + '</h2><button type="button" class="btn btn-sm btn-ghost" data-act="rm-goal" data-id="' + g.id + '">Remove<span class="sr"> ' + esc(g.name) + '</span></button></div><p>Goal: <strong>' + money(g.target, 0) + '</strong> by ' + g.year + ' · Saved so far ' + money(g.saved, 0) + ' · Saving ' + money(g.monthly, 0) + '/month</p>' + SB.meter(Math.min(100, pct), 100, 'Projected progress toward ' + g.name) + '<p>' + (pct >= 100 ? SB.badge('On track', 'ok') + ' Projected ' + money(fv, 0) + ' (' + nf(pct, 0) + '% of goal).' : SB.badge('Needs attention', 'warn') + ' Projected ' + money(fv, 0) + ' (' + nf(pct, 0) + '% of goal). Saving about <strong>' + money(need, 0) + '/month</strong> would reach it.') + '</p></section>';
    }).join('');
    return SB.page('Financial Planning', 'Set goals, then see whether your savings are on track. Projections assume a steady 5% yearly return, which is not guaranteed.', rb() + (cards || SB.empty('<p>No goals yet. Add your first goal below.</p>')) +
      '<form class="card" data-form="goal" novalidate aria-labelledby="fp1"><h2 id="fp1">Add a goal</h2><div class="form-grid">' + SB.field({ id: 'fp-n', name: 'name', label: 'Goal name', attrs: ' maxlength="40" required' }) + SB.field({ id: 'fp-t', name: 'target', label: 'Target amount (USD)', type: 'number', attrs: ' min="1" step="100" required' }) + SB.field({ id: 'fp-y', name: 'year', label: 'Target year', type: 'number', value: thisYear + 5, attrs: ' min="' + thisYear + '" max="' + (thisYear + 60) + '" required' }) + SB.field({ id: 'fp-s', name: 'saved', label: 'Saved so far (USD)', type: 'number', value: '0', attrs: ' min="0" step="100"' }) + SB.field({ id: 'fp-m', name: 'monthly', label: 'Monthly saving (USD)', type: 'number', value: '100', attrs: ' min="0" step="10"' }) + '</div><div class="form-err notice err" role="alert" hidden></div><button class="btn btn-accent" type="submit">Add goal</button></form>');
  };
  FM['goal'] = function (f) {
    SB.clearErr(f); const d = SB.fd(f);
    if (!(d.name || '').trim()) { SB.fail(f, 'Enter a goal name.'); return; } if (!(+d.target > 0)) { SB.fail(f, 'Enter a target amount above zero.'); return; } if (!(+d.year >= thisYear)) { SB.fail(f, 'Choose a target year of ' + thisYear + ' or later.'); return; }
    st().goals.push({ id: SB.uid('g'), name: d.name.trim(), target: +d.target, year: Math.round(+d.year), saved: Math.max(0, +d.saved || 0), monthly: Math.max(0, +d.monthly || 0) }); SB.save(); SB.success({ ok: true, msg: 'Goal “' + d.name.trim() + '” added.' });
  };
  A['rm-goal'] = function (el) { const s = st(); s.goals = s.goals.filter(function (g) { return g.id !== el.dataset.id; }); SB.save(); SB.rerender(); };

  /* ----- Investment Management: risk quiz + portfolio builder ----- */
  const QUIZ = [
    ['When will you need this money?', ['Within 3 years', '3–7 years', '7–15 years', 'More than 15 years']],
    ['Your portfolio falls 20% in a few months. You…', ['Sell everything', 'Sell some', 'Hold and wait', 'Buy more']],
    ['How much investing experience do you have?', ['None', 'A little', 'Some', 'A lot']],
    ['How stable is your income?', ['Unpredictable', 'Somewhat stable', 'Stable', 'Very stable, with savings']],
    ['What matters most?', ['Protecting what I have', 'Steady income', 'A balance', 'Long-term growth']]
  ];
  const CLASS = function (s) { return s.type === 'bond' || /Bond/.test(s.sector) ? 'Bonds' : s.sector === 'Commodities' ? 'Gold' : s.sector === 'Real Estate' ? 'Real estate' : s.sector === 'Foreign Large Blend' ? 'International stocks' : 'U.S. stocks'; };
  function pbState() {
    if (!SB.ui.pb) { const m = SB.MODELS[2]; SB.ui.pb = { model: m.id, rows: Object.keys(m.w).map(function (k) { return { sym: k, w: m.w[k] }; }), acct: null, amount: null }; }
    const pb = SB.ui.pb; if (!pb.acct || !st().accounts.some(function (a) { return a.id === pb.acct; })) pb.acct = st().activeAcct;
    return pb;
  }
  function plan(pb) {
    const a = SB.acct(pb.acct), amt = +pb.amount > 0 ? +pb.amount : 0, rows = pb.rows.map(function (r) {
      const s = SB.bySym[r.sym], dollars = amt * r.w / 100, unit = SB.unit(s); let qty = s.type === 'bond' ? Math.floor(dollars / unit) : Math.floor(dollars / s.price * 10000) / 10000;
      return { s: s, w: r.w, dollars: dollars, qty: qty, cost: qty * unit };
    });
    return { a: a, amt: amt, rows: rows, sumW: pb.rows.reduce(function (t, r) { return t + (+r.w || 0); }, 0), cost: rows.reduce(function (t, r) { return t + r.cost; }, 0) };
  }
  F.pbpreview = function () {
    const pb = pbState(), p = plan(pb);
    if (!p.rows.length) return SB.empty('<p>Add at least one security to build a portfolio.</p>');
    const cls = {}; p.rows.forEach(function (r) { const c = CLASS(r.s); cls[c] = (cls[c] || 0) + r.w; });
    let exp = 0, yld = 0; p.rows.forEach(function (r) { exp += (r.s.exp || 0) * r.w / 100; yld += (r.s.type === 'bond' ? SB.ytm(r.s) : (r.s.div || 0)) * r.w / 100; });
    const ok = Math.abs(p.sumW - 100) < 0.001, afford = p.cost <= SB.availableCash(p.a) + 1e-6 && p.amt > 0;
    return '<div class="grid g2"><div>' + SB.donut(Object.keys(cls).map(function (k) { return { label: k, value: cls[k] }; }), { center: 'Mix', pct: true }) + '</div><div class="grid g2">' + SB.tile('Blended expense ratio', nf(exp, 3) + '%', 'Weighted fund fees') + SB.tile('Blended yield', nf(yld, 2) + '%', 'Dividends and bond yields') + SB.tile('Weights total', nf(p.sumW, 1) + '%', ok ? '✓ Ready' : 'Must equal 100%') + SB.tile('Estimated cost', money(p.cost), 'Cash available ' + money(SB.availableCash(p.a))) + '</div></div>' +
      SB.tableWrap('Planned purchases', '<table class="tbl"><caption class="sr">Planned purchases for the portfolio</caption><thead><tr><th scope="col">Security</th><th scope="col">Weight</th><th scope="col">Target amount</th><th scope="col">Units to buy</th><th scope="col">Cost</th></tr></thead><tbody>' + p.rows.map(function (r) { return '<tr><th scope="row">' + SB.symLink(r.s) + '<br><span class="muted small">' + esc(r.s.name) + '</span></th><td class="num">' + nf(r.w, 1) + '%</td><td class="num">' + money(r.dollars) + '</td><td class="num">' + (r.qty ? SB.qty(r.qty) : '<span class="warn-text">0 (too small)</span>') + '</td><td class="num">' + money(r.cost) + '</td></tr>'; }).join('') + '</tbody></table>') +
      (!ok ? SB.notice('Weights add up to ' + nf(p.sumW, 1) + '%. Adjust them, or use “Make weights total 100%”.', 'warn') : '') + (p.amt > 0 && !afford ? SB.notice('The planned purchases cost more than the available cash in ' + esc(p.a.name) + '. Lower the amount or transfer money in.', 'warn') : '');
  };
  P['investment-management'] = function () {
    const pb = pbState(), a = SB.acct(pb.acct); if (pb.amount == null) pb.amount = Math.max(0, Math.min(10000, Math.floor(SB.availableCash(a))));
    const q = QUIZ.map(function (x, i) { return SB.radios('q' + i, x[1].map(function (o, j) { return [j + 1, o]; }), '', (i + 1) + '. ' + x[0]); }).join('');
    const used = pb.rows.map(function (r) { return r.sym; }), add = SB.securities.filter(function (s) { return used.indexOf(s.sym) < 0; }).map(function (s) { return [s.sym, s.sym + ' — ' + s.name]; });
    return SB.page('Investment Management', 'Build a diversified portfolio in three steps: find a starting mix, fine-tune it, then invest.', rb() +
      '<form class="card" data-form="risk-quiz" novalidate aria-labelledby="im1"><h2 id="im1">Step 1 · Find a starting mix (optional)</h2><p class="muted">Five quick questions suggest a model portfolio. You can also pick one yourself.</p><div class="quiz-grid">' + q + '</div><div class="form-err notice err" role="alert" hidden></div><button class="btn btn-primary" type="submit">Suggest a portfolio</button></form>' +
      '<form class="card" data-form="pb" data-init="pb" novalidate aria-labelledby="im2"><h2 id="im2">Step 2 · Fine-tune your holdings</h2>' + SB.field({ id: 'pb-model', label: 'Start from a model', options: SB.MODELS.map(function (m) { return [m.id, m.name]; }).concat([['custom', 'Custom']]), value: pb.model, attrs: ' data-change="pb-model"', hint: (SB.MODELS.find(function (m) { return m.id === pb.model; }) || { blurb: 'Your own mix.' }).blurb }) +
      SB.tableWrap('Holdings', '<table class="tbl"><caption class="sr">Portfolio holdings and weights</caption><thead><tr><th scope="col">Security</th><th scope="col">Weight (%)</th><th scope="col">Remove</th></tr></thead><tbody>' + pb.rows.map(function (r, i) { const s = SB.bySym[r.sym]; return '<tr><th scope="row">' + esc(r.sym) + '<br><span class="muted small">' + esc(s.name) + '</span></th><td><label class="sr" for="pbw' + i + '">Weight for ' + r.sym + ' in percent</label><input class="input narrow" id="pbw' + i + '" type="number" min="0" max="100" step="1" value="' + r.w + '" data-input="pb-w" data-i="' + i + '"></td><td><button type="button" class="btn btn-sm btn-ghost" data-act="pb-rm" data-i="' + i + '">Remove<span class="sr"> ' + r.sym + '</span></button></td></tr>'; }).join('') + '</tbody></table>') +
      '<div class="row wrap end">' + SB.field({ id: 'pb-add', label: 'Add a security', options: add, attrs: '' }) + '<button type="button" class="btn" data-act="pb-add">Add</button><button type="button" class="btn" data-act="pb-norm">Make weights total 100%</button></div></form>' +
      '<form class="card" data-form="pb-go" novalidate aria-labelledby="im3"><h2 id="im3">Step 3 · Invest</h2><div class="form-grid">' + SB.field({ id: 'pb-acct', name: 'acct', label: 'Account', options: SB.acctOptions(), value: pb.acct, attrs: ' data-change="pb-acct"' }) + SB.field({ id: 'pb-amt', name: 'amount', label: 'Amount to invest (USD)', type: 'number', value: pb.amount, attrs: ' min="0" step="100" data-input="pb-amt"' }) + '</div>' + SB.live('pbpreview') + '<div class="form-err notice err" role="alert" hidden></div><button class="btn btn-accent" type="submit">Review &amp; invest</button><p class="muted small">Buys are market orders in the selected account. Fractional shares are used where available; bonds are bought in whole units.</p></form>');
  };
  SB.inits.pb = function () { };
  FM['pb'] = function () { };
  CH['pb-model'] = function (el) { const pb = pbState(); pb.model = el.value; const m = SB.MODELS.find(function (x) { return x.id === el.value; }); if (m) pb.rows = Object.keys(m.w).map(function (k) { return { sym: k, w: m.w[k] }; }); SB.rerender(); };
  CH['pb-acct'] = function (el) { pbState().acct = el.value; SB.updateLive(true); };
  IN['pb-w'] = function (el) { const pb = pbState(); pb.rows[+el.dataset.i].w = Math.max(0, +el.value || 0); pb.model = 'custom'; SB.updateLive(true); };
  IN['pb-amt'] = function (el) { pbState().amount = el.value; SB.updateLive(true); };
  A['pb-rm'] = function (el) { const pb = pbState(); pb.rows.splice(+el.dataset.i, 1); pb.model = 'custom'; SB.rerender(); };
  A['pb-add'] = function () { const pb = pbState(), sel = document.getElementById('pb-add'); if (sel && sel.value) { pb.rows.push({ sym: sel.value, w: 0 }); pb.model = 'custom'; SB.rerender(); } };
  A['pb-norm'] = function () { const pb = pbState(), t = pb.rows.reduce(function (s, r) { return s + r.w; }, 0); if (!t) { SB.toast('Enter at least one weight first.', 'err'); return; } let run = 0; pb.rows.forEach(function (r, i) { if (i === pb.rows.length - 1) r.w = Math.round((100 - run) * 10) / 10; else { r.w = Math.round(r.w / t * 1000) / 10; run += r.w; } }); SB.rerender(); };
  FM['risk-quiz'] = function (f) {
    SB.clearErr(f); let score = 0; for (let i = 0; i < QUIZ.length; i++) { const v = +f.elements['q' + i].value; if (!v) { SB.fail(f, 'Please answer question ' + (i + 1) + '.'); return; } score += v; }
    const m = SB.MODELS[score <= 8 ? 0 : score <= 11 ? 1 : score <= 14 ? 2 : score <= 17 ? 3 : 4], pb = pbState();
    pb.model = m.id; pb.rows = Object.keys(m.w).map(function (k) { return { sym: k, w: m.w[k] }; });
    SB.success({ ok: true, msg: 'Your answers suggest the “' + m.name + '” mix. It has been loaded below — adjust it in step 2.' });
  };
  FM['pb-go'] = function (f) {
    SB.clearErr(f); const pb = pbState(), p = plan(pb);
    if (!pb.rows.length) { SB.fail(f, 'Add at least one security.'); return; }
    if (Math.abs(p.sumW - 100) > 0.001) { SB.fail(f, 'Weights must total 100% (currently ' + nf(p.sumW, 1) + '%).'); return; }
    if (!(p.amt > 0)) { SB.fail(f, 'Enter an amount to invest.'); return; }
    const buys = p.rows.filter(function (r) { return r.qty > 0; });
    if (!buys.length) { SB.fail(f, 'The amount is too small to buy any of these securities.'); return; }
    if (p.cost > SB.availableCash(p.a) + 1e-6) { SB.fail(f, 'You need ' + money(p.cost) + ' but ' + p.a.name + ' has ' + money(SB.availableCash(p.a)) + ' available.'); return; }
    SB.dialog('Confirm your portfolio', '<p>Place <strong>' + buys.length + ' market buy orders</strong> in ' + esc(p.a.name) + ' for about <strong>' + money(p.cost) + '</strong>?</p><ul class="plain">' + buys.map(function (r) { return '<li class="row between"><span>' + r.s.sym + '</span><span>' + SB.qty(r.qty) + ' · ' + money(r.cost) + '</span></li>'; }).join('') + '</ul><div class="row wrap"><button type="button" class="btn btn-accent" data-act="pb-confirm">Invest now</button><button type="button" class="btn" data-act="dlg-close">Go back</button></div>');
  };
  A['pb-confirm'] = function () {
    const pb = pbState(), p = plan(pb); let ok = 0, fail = 0;
    p.rows.forEach(function (r) { if (r.qty > 0) { const res = SB.placeOrder({ acct: p.a.id, sym: r.s.sym, side: 'buy', type: 'market', mode: 'qty', qty: r.qty }); if (res.ok) ok++; else fail++; } });
    SB.closeDialog(); SB.success({ ok: fail === 0, msg: ok + ' order' + (ok === 1 ? '' : 's') + ' filled' + (fail ? ', ' + fail + ' could not be placed' : '') + '. Review them in Account Positions.' });
  };

  P['wealth-insights'] = function () {
    return SB.page('Wealth Management Insights', 'Short reads on planning, costs and behavior. Educational content written for the simulator.', '<div class="card">' + SB.INSIGHTS.map(function (a) { return '<details class="lesson"><summary><span>' + esc(a.title) + '</span> <span class="muted small">' + a.mins + ' min read</span></summary><div class="lesson-body">' + a.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div></details>'; }).join('') + '</div>');
  };

  /* ================= News & Research ================= */
  SB.ui.nf = { cat: 'all', q: '', watch: false };
  F.newslist = function () {
    const f = SB.ui.nf, w = st().watch; let l = SB.news.slice();
    if (f.cat !== 'all') l = l.filter(function (n) { return n.cat === f.cat; });
    if (f.watch) l = l.filter(function (n) { return n.sym && w.indexOf(n.sym) > -1; });
    if (f.q) { const q = f.q.toLowerCase(); l = l.filter(function (n) { return (n.title + ' ' + (n.sym || '')).toLowerCase().indexOf(q) > -1; }); }
    if (!l.length) return SB.empty(SB.newsError ? '<p>News could not be loaded right now. It will retry automatically.</p>' : SB.dataMode === 'real' && !SB.news.length ? '<p>Loading the latest news…</p>' : '<p>No stories match your filters.</p>');
    return '<p class="muted small" role="status">' + l.length + ' stor' + (l.length === 1 ? 'y' : 'ies') + '</p><ul class="plain news-list">' + l.map(function (n) { return '<li><a class="news-title" href="#news-' + n.id + '">' + esc(n.title) + '</a><p class="muted small">' + esc(n.cat) + ' · ' + SB.timeAgo(n.ts) + (n.sym ? ' · <a href="#quote-' + n.sym + '">' + n.sym + '</a>' : '') + ' · ' + (n.real ? SB.badge(n.source || 'News', 'real') : SB.badge('Simulated', 'sim')) + '</p></li>'; }).join('') + '</ul>';
  };
  A['nf-cat'] = function (el) { SB.ui.nf.cat = el.dataset.v; SB.rerender(); };
  IN['nf-q'] = function (el) { SB.ui.nf.q = el.value; SB.updateLive(true); };
  CH['nf-watch'] = function (el) { SB.ui.nf.watch = el.checked; SB.updateLive(true); };
  P.news = function () {
    const f = SB.ui.nf;
    return SB.page('News & Research', (SB.dataMode === 'real' ? 'Real headlines from news providers. We show the headline and a short summary; open the source to read the full story.' : 'Stay on top of the (simulated) markets. Every story is generated for this simulator and reacts to simulated price moves — none of it is real news.'), rb() +
      '<section class="card" aria-labelledby="nw1"><h2 id="nw1" class="sr">Filter stories</h2>' + SB.seg('nf-cat', (SB.dataMode === 'real' ? [['all', 'All'], ['Markets', 'Markets'], ['Company', 'Company']] : [['all', 'All'], ['Markets', 'Markets'], ['Stocks', 'Stocks'], ['Economy', 'Economy'], ['Funds & ETFs', 'Funds & ETFs'], ['Bonds', 'Bonds']]), f.cat, 'Story category') + '<div class="form-grid mt">' + SB.field({ id: 'nw-q', label: 'Search headlines', type: 'search', value: f.q, attrs: ' data-input="nf-q" autocomplete="off"' }) + '<label class="switch"><input type="checkbox" data-change="nf-watch"' + (f.watch ? ' checked' : '') + '><span><strong>Only my watchlist</strong><br><span class="muted small">Stories about securities you watch.</span></span></label></div></section>' +
      '<section class="card" aria-labelledby="nw2"><h2 id="nw2">Latest stories</h2>' + SB.live('newslist') + '</section>');
  };
  P.story = function (id) {
    const n = SB.news.find(function (x) { return String(x.id) === String(id); });
    if (!n) return SB.page('Story not found', '', SB.empty('<p>That story is no longer available.</p><p><a class="btn btn-primary" href="#news">Back to news</a></p>'));
    const s = n.sym ? SB.bySym[n.sym] : null;
    return SB.page(n.title, esc(n.cat) + ' · ' + SB.timeAgo(n.ts) + ' · ' + (n.real ? SB.badge(n.source || 'News', 'real') : SB.badge('Simulated', 'sim')), '<article class="card prose">' + n.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + (n.real ? '<p><a class="btn btn-primary" href="' + esc(n.url) + '" target="_blank" rel="noopener noreferrer">Read the full story at ' + esc(n.source || 'the source') + '<span class="sr"> (opens in a new tab)</span></a></p><p class="muted small">Headline and summary come from the publisher via a news data provider. SnowBall+ does not republish full articles.</p>' : '') + '</article>' +
      (s ? '<section class="card" aria-labelledby="st1"><h2 id="st1">Mentioned</h2><div class="row between wrap"><span>' + SB.symLink(s) + ' ' + esc(s.name) + ' · ' + SB.pxText(s) + ' ' + SB.quoteChg(s) + '</span><span><button type="button" class="btn btn-sm btn-primary" data-act="trade-sym" data-sym="' + s.sym + '" data-side="buy">Buy</button> <a class="btn btn-sm" href="#quote-' + s.sym + '">Quote</a></span></div></section>' : '') + '<p><a class="btn" href="#news">← Back to news</a></p>');
  };
  P.notfound = function () { return SB.page('Page not found', '', SB.empty('<p>We could not find that page.</p><p><a class="btn btn-primary" href="#home">Go to Overview</a></p>')); };
})();
