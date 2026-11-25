/* SnowBall+ — pages for the "Accounts & Trade" menu, plus shared live fragments. */
(function () {
  'use strict';
  const SB = window.SB, esc = SB.esc, money = SB.money, nf = SB.nf;
  SB.inits = SB.inits || {};
  const P = SB.pages, F = SB.frag, A = SB.acts, FM = SB.forms, IN = SB.inputs, CH = SB.changes;
  const st = function () { return SB.state(); };
  SB.ui.sort = { key: 'val', dir: -1 };

  SB.fd = function (f) { const o = {}; new FormData(f).forEach(function (v, k) { o[k] = v; }); return o; };
  SB.fail = function (f, msg) {
    const e = f.querySelector('.form-err'); if (!e) { SB.toast(msg, 'err'); return; }
    e.textContent = msg; e.hidden = false; e.setAttribute('tabindex', '-1'); e.focus();
  };
  SB.clearErr = function (f) { const e = f.querySelector('.form-err'); if (e) { e.textContent = ''; e.hidden = true; } };
  SB.success = function (r) { SB.toast(r.msg, r.ok ? 'ok' : 'err'); SB.ui.result = r; SB.rerender(); const b = document.getElementById('result-box'); if (b) b.focus(); };
  function resultBox() { const r = SB.ui.result; return r ? '<div class="notice ' + (r.ok ? 'ok' : 'err') + '" role="status" tabindex="-1" id="result-box">' + esc(r.msg) + '</div>' : ''; }
  SB.resultBox = resultBox;
  function acctPick(id, val, label) {
    return SB.field({ id: id, label: label || 'Account', options: SB.acctOptions({ all: true }), value: val, attrs: ' data-change="pf-acct"' });
  }
  CH['pf-acct'] = function (el) { SB.ui.pf = el.value; SB.rerender(); };
  function pf() { const v = SB.ui.pf || 'all'; return v === 'all' || st().accounts.some(function (a) { return a.id === v; }) ? v : 'all'; }
  function tradeBtns(s) {
    return '<button type="button" class="btn btn-sm btn-primary" data-act="trade-sym" data-sym="' + s.sym + '" data-side="buy">Buy<span class="sr"> ' + s.sym + '</span></button> <button type="button" class="btn btn-sm" data-act="trade-sym" data-sym="' + s.sym + '" data-side="sell">Sell<span class="sr"> ' + s.sym + '</span></button>';
  }
  A['trade-sym'] = function (el) { SB.ui.prefill = { sym: el.dataset.sym, side: el.dataset.side || 'buy' }; SB.go('trade'); };

  /* ================= live fragments ================= */
  F.totals = function (arg) {
    const list = SB.acctsFor(arg || 'all'), val = SB.sumValue(list), day = SB.dayChange(list), cost = SB.costBasis(list);
    const posv = list.reduce(function (t, a) { return t + SB.posValue(a); }, 0), cash = list.reduce(function (t, a) { return t + SB.availableCash(a); }, 0), gl = posv - cost;
    return '<div class="grid g4">' +
      SB.tile('Total value', money(val), 'Investments ' + money(posv, 0) + ' · Cash ' + money(list.reduce(function (t, a) { return t + a.cash; }, 0), 0)) +
      SB.tile('Today’s change', SB.chg(day, val - day ? day / (val - day) * 100 : 0)) +
      SB.tile('Cash available to trade', money(cash)) +
      SB.tile('Unrealized gain/loss', SB.chg(gl, cost ? gl / cost * 100 : 0), 'On cost basis of ' + money(cost, 0)) + '</div>';
  };
  F.alloc = function (arg) { return SB.donut(SB.allocation(SB.acctsFor(arg || 'all')), { center: 'Total value' }); };
  F.perf = function (arg) {
    const r = SB.ui.pr || '3M', n = { '1M': 22, '3M': 63, '6M': 126, '1Y': 252 }[r];
    const vals = SB.series(SB.acctsFor(arg || 'all'), n), L = SB.dates.length, f = function (d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    return SB.lineChart(vals, { title: 'Value of current holdings over ' + r, labels: [f(SB.dates[L - n]), f(SB.dates[L - Math.round(n / 2)]), f(SB.dates[L - 1])] });
  };
  A['pr'] = function (el) { SB.ui.pr = el.dataset.v; SB.rerender(); };

  function rowsFor(arg) {
    const list = SB.acctsFor(arg), agg = {};
    list.forEach(function (a) { Object.keys(a.positions).forEach(function (k) { const p = a.positions[k], g = agg[k] || (agg[k] = { qty: 0, cost: 0 }); g.qty += p.qty; g.cost += p.cost; }); });
    const total = SB.sumValue(list);
    return Object.keys(agg).map(function (k) {
      const s = SB.bySym[k], g = agg[k], val = g.qty * SB.unit(s), day = g.qty * (SB.unit(s) - SB.unitAt(s, s.prev));
      return { s: s, sym: k, qty: g.qty, cost: g.cost, val: val, day: day, gl: val - g.cost, glp: g.cost ? (val - g.cost) / g.cost * 100 : 0, share: total ? val / total * 100 : 0, last: s.price };
    });
  }
  F.positions = function (arg) {
    arg = arg || 'all'; const list = SB.acctsFor(arg), cash = list.reduce(function (t, a) { return t + a.cash; }, 0), total = SB.sumValue(list), so = SB.ui.sort;
    const rows = rowsFor(arg).sort(function (a, b) { const x = a[so.key], y = b[so.key]; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * so.dir; });
    if (!rows.length) return SB.empty('<p>You do not hold any investments in ' + (arg === 'all' ? 'these accounts' : 'this account') + ' yet.</p><p><a class="btn btn-primary" href="#trade">Place your first trade</a></p>') + '<p class="muted">Cash and cash equivalents: <strong>' + money(cash) + '</strong></p>';
    const cols = [['sym', 'Symbol'], ['qty', 'Quantity'], ['last', 'Last price'], ['day', 'Today’s change'], ['val', 'Current value'], ['cost', 'Cost basis'], ['gl', 'Total gain/loss'], ['share', '% of account']];
    const th = cols.map(function (c) { return '<th scope="col" aria-sort="' + (so.key === c[0] ? (so.dir > 0 ? 'ascending' : 'descending') : 'none') + '"><button type="button" class="th-btn" data-act="sort" data-key="' + c[0] + '">' + c[1] + (so.key === c[0] ? (so.dir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>'; }).join('');
    const tr = rows.map(function (r) {
      return '<tr><th scope="row">' + SB.symLink(r.s) + '<br><span class="muted small">' + esc(r.s.name) + '</span></th><td class="num">' + SB.qty(r.qty) + '</td><td class="num">' + SB.pxText(r.s) + '</td><td class="num">' + SB.chg(r.day, SB.dayOf(r.s).pct) + '</td><td class="num">' + money(r.val) + '</td><td class="num">' + money(r.cost) + '</td><td class="num">' + SB.chg(r.gl, r.glp) + '</td><td class="num">' + nf(r.share, 1) + '%</td><td>' + tradeBtns(r.s) + '</td></tr>';
    }).join('');
    const sums = rows.reduce(function (t, r) { t.val += r.val; t.cost += r.cost; t.day += r.day; return t; }, { val: 0, cost: 0, day: 0 });
    return SB.tableWrap('Account positions', '<table class="tbl"><caption class="sr">Positions with current value, cost basis and gain or loss. Column headers are sort buttons.</caption><thead><tr>' + th + '<th scope="col">Trade</th></tr></thead><tbody>' + tr +
      '<tr><th scope="row">Cash &amp; cash equivalents<br><span class="muted small">Core position</span></th><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">' + money(cash) + '</td><td class="num">—</td><td class="num">—</td><td class="num">' + nf(total ? cash / total * 100 : 0, 1) + '%</td><td></td></tr></tbody>' +
      '<tfoot><tr><th scope="row">Account total</th><td></td><td></td><td class="num">' + SB.chg(sums.day, null) + '</td><td class="num">' + money(total) + '</td><td class="num">' + money(sums.cost) + '</td><td class="num">' + SB.chg(sums.val - sums.cost, sums.cost ? (sums.val - sums.cost) / sums.cost * 100 : 0) + '</td><td class="num">100%</td><td></td></tr></tfoot></table>');
  };
  A['sort'] = function (el) { const so = SB.ui.sort, k = el.dataset.key; if (so.key === k) so.dir *= -1; else { so.key = k; so.dir = k === 'sym' ? 1 : -1; } SB.rerender(); };
  A['copy-positions'] = function () {
    const rows = [['Symbol', 'Name', 'Quantity', 'Last', 'Value', 'Cost basis', 'Gain/Loss']].concat(rowsFor(pf()).map(function (r) { return [r.sym, r.s.name, r.qty, r.s.price, r.val.toFixed(2), r.cost.toFixed(2), r.gl.toFixed(2)]; }));
    SB.copy(SB.csv(rows)).then(function (ok) { SB.toast(ok ? 'Positions copied as CSV.' : 'Copy is not available in this browser.', ok ? 'ok' : 'err'); });
  };
  F.holdings5 = function (arg) {
    const rows = rowsFor(arg || 'all').sort(function (a, b) { return b.val - a.val; }).slice(0, 5);
    if (!rows.length) return SB.empty('<p>No investments yet.</p>');
    return SB.tableWrap('Top holdings', '<table class="tbl"><caption class="sr">Top five holdings by value</caption><thead><tr><th scope="col">Symbol</th><th scope="col" class="num">Value</th><th scope="col" class="num">Today</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><th scope="row">' + SB.symLink(r.s) + '</th><td class="num">' + money(r.val) + '</td><td class="num">' + SB.chg(r.day, SB.dayOf(r.s).pct, { noMoney: true }) + '</td></tr>'; }).join('') + '</tbody></table>');
  };
  F.watchlist = function () {
    const w = st().watch.map(function (k) { return SB.bySym[k]; }).filter(Boolean);
    if (!w.length) return SB.empty('<p>Your watchlist is empty. Search for a symbol and choose “Add to watchlist”.</p>');
    return SB.tableWrap('Watchlist', '<table class="tbl"><caption class="sr">Watchlist with last price and today’s change</caption><thead><tr><th scope="col">Symbol</th><th scope="col">Last</th><th scope="col">Today</th><th scope="col">Actions</th></tr></thead><tbody>' + w.map(function (s) {
      return '<tr><th scope="row">' + SB.symLink(s) + '<br><span class="muted small">' + esc(s.name) + '</span></th><td class="num">' + SB.pxText(s) + '</td><td class="num">' + SB.quoteChg(s) + '</td><td>' + tradeBtns(s) + ' <button type="button" class="btn btn-sm btn-ghost" data-act="unwatch" data-sym="' + s.sym + '">Remove<span class="sr"> ' + s.sym + ' from watchlist</span></button></td></tr>';
    }).join('') + '</tbody></table>');
  };
  A['unwatch'] = function (el) { const s = st(); s.watch = s.watch.filter(function (x) { return x !== el.dataset.sym; }); SB.save(); SB.toast(el.dataset.sym + ' removed from watchlist.', 'info'); SB.rerender(); };
  A['watch'] = function (el) { const s = st(); const k = el.dataset.sym; if (s.watch.indexOf(k) < 0) { s.watch.push(k); SB.toast(k + ' added to watchlist.', 'ok'); } else { s.watch = s.watch.filter(function (x) { return x !== k; }); SB.toast(k + ' removed from watchlist.', 'info'); } SB.save(); SB.rerender(); };
  F.movers = function () {
    const l = SB.securities.filter(function (s) { return s.type === 'stock' || s.type === 'etf'; }).map(function (s) { return { s: s, p: SB.dayOf(s).pct }; }).sort(function (a, b) { return b.p - a.p; });
    const li = function (arr) { return '<ul class="plain">' + arr.map(function (x) { return '<li class="row between"><span>' + SB.symLink(x.s) + ' <span class="muted small">' + esc(x.s.name) + '</span></span><span>' + SB.chg(x.p, x.p, { noMoney: true }).replace(/\(|\)/g, '') + '</span></li>'; }).join('') + '</ul>'; };
    return '<div class="grid g2"><div><h3>Top gainers</h3>' + li(l.slice(0, 3)) + '</div><div><h3>Top decliners</h3>' + li(l.slice(-3).reverse()) + '</div></div>';
  };
  F.markets = function () {
    const items = [['SPY', 'S&P 500 (SPY)'], ['QQQ', 'Nasdaq-100 (QQQ)'], ['VTI', 'Total market (VTI)'], ['GLD', 'Gold (GLD)']];
    return '<div class="grid g4">' + items.map(function (i) { const s = SB.bySym[i[0]]; return SB.tile(i[1], SB.pxText(s), SB.quoteChg(s)); }).join('') + SB.tile('10-yr Treasury yield', nf(SB.ytm(SB.bySym.UST10Y), 2) + '%', (SB.bySym.UST10Y.src === 'real' ? 'Real yield; ' : 'Simulated; ') + 'note priced at ' + nf(SB.bySym.UST10Y.price, 2)) + '</div>';
  };
  const ST = { open: 'Open', filled: 'Filled', cancelled: 'Cancelled', rejected: 'Rejected' };
  F.orders = function (arg) {
    const l = SB.openOrders(arg || 'all');
    if (!l.length) return SB.empty('<p>No open orders. Limit and stop orders you place will wait here until the price reaches your level.</p>');
    return SB.tableWrap('Open orders', '<table class="tbl"><caption class="sr">Open orders</caption><thead><tr><th scope="col">Placed</th><th scope="col">Account</th><th scope="col">Order</th><th scope="col">Last price</th><th scope="col">Action</th></tr></thead><tbody>' + l.map(function (o) {
      return '<tr><td>' + SB.timeAgo(o.created) + '</td><td>' + esc(SB.acct(o.acct).name) + '</td><td>' + esc(SB.describeOrder(o)) + (o.triggered ? ' <span class="badge">Triggered</span>' : '') + '</td><td class="num">' + SB.pxText(SB.bySym[o.sym]) + '</td><td><button type="button" class="btn btn-sm" data-act="cancel-order" data-id="' + o.id + '">Cancel<span class="sr"> order for ' + o.sym + '</span></button></td></tr>';
    }).join('') + '</tbody></table>');
  };
  A['cancel-order'] = function (el) { const r = SB.cancelOrder(el.dataset.id); SB.toast(r.msg, r.ok ? 'info' : 'err'); SB.rerender(); };
  F.recent = function (arg) {
    const l = st().orders.filter(function (o) { return o.status !== 'open' && (!arg || arg === 'all' || o.acct === arg); }).slice(0, 8);
    if (!l.length) return SB.empty('<p>No completed orders yet.</p>');
    return SB.tableWrap('Recent orders', '<table class="tbl"><caption class="sr">Recent completed orders</caption><thead><tr><th scope="col">When</th><th scope="col">Order</th><th scope="col">Status</th><th scope="col">Fill price</th><th scope="col">Total</th></tr></thead><tbody>' + l.map(function (o) {
      return '<tr><td>' + SB.dateTime(o.filled || o.created) + '</td><td>' + esc(SB.describeOrder(o)) + '</td><td>' + SB.badge(ST[o.status], o.status) + (o.reason ? '<br><span class="muted small">' + esc(o.reason) + '</span>' : '') + '</td><td class="num">' + (o.fillPrice ? SB.priceStr(SB.bySym[o.sym], o.fillPrice) : '—') + '</td><td class="num">' + (o.total ? money(o.total) : '—') + '</td></tr>';
    }).join('') + '</tbody></table>');
  };

  /* ================= Overview / Portfolio / Positions ================= */
  P.home = function () {
    const news = SB.news.slice(0, 4);
    return SB.page('Welcome to SnowBall+', (SB.dataMode === 'real' ? 'Practice investing with fictional money. Prices and news are real market data — no real money is ever at risk.' : 'Practice investing with simulated money. Prices, funds, bonds and news are generated for learning — no real money is ever at risk.'),
      resultBox() +
      '<section aria-labelledby="s1"><h2 id="s1" class="sr">Your accounts</h2>' + SB.live('totals', 'all') + '</section>' +
      '<section class="card" aria-labelledby="s2"><h2 id="s2">Markets</h2>' + SB.live('markets') + '</section>' +
      '<div class="grid g2"><section class="card" aria-labelledby="s3"><div class="row between"><h2 id="s3">Watchlist</h2><a href="#self-directed" class="btn btn-sm">Research</a></div>' + SB.live('watchlist') + '</section>' +
      '<section class="card" aria-labelledby="s4"><h2 id="s4">Movers</h2>' + SB.live('movers') + '<h2 class="mt" id="s5">Quick actions</h2><div class="row wrap"><a class="btn btn-accent" href="#trade">Trade</a><a class="btn btn-primary" href="#investment-management">Build a portfolio</a><a class="btn" href="#education">Learn</a></div></section></div>' +
      '<section class="card" aria-labelledby="s6"><div class="row between"><h2 id="s6">Latest news</h2><a href="#news" class="btn btn-sm">All news</a></div><ul class="plain news-list">' + news.map(newsItem).join('') + '</ul></section>');
  };
  function newsItem(n) {
    return '<li><a class="news-title" href="#news-' + n.id + '">' + esc(n.title) + '</a><p class="muted small">' + esc(n.cat) + ' · ' + SB.timeAgo(n.ts) + ' · ' + (n.real ? SB.badge(n.source || 'News', 'real') : SB.badge('Simulated', 'sim')) + '</p></li>';
  }
  SB.newsItem = newsItem;

  P.portfolio = function () {
    const v = pf();
    return SB.page('Portfolio', 'See how your accounts are invested and how they have performed.',
      resultBox() + '<div class="card">' + acctPick('pf', v, 'Show') + '</div>' +
      '<section aria-labelledby="p1"><h2 id="p1" class="sr">Summary</h2>' + SB.live('totals', v) + '</section>' +
      '<div class="grid g2"><section class="card" aria-labelledby="p2"><h2 id="p2">Asset allocation</h2>' + SB.live('alloc', v) + '</section>' +
      '<section class="card" aria-labelledby="p3"><h2 id="p3">Performance</h2>' + SB.seg('pr', [['1M', '1 month'], ['3M', '3 months'], ['6M', '6 months'], ['1Y', '1 year']], SB.ui.pr || '3M', 'Chart time range') + SB.live('perf', v) + '<p class="muted small">Based on your current holdings applied to historical ' + (SB.dataMode === 'real' ? 'real' : 'simulated') + ' prices.</p></section></div>' +
      '<section class="card" aria-labelledby="p4"><div class="row between"><h2 id="p4">Top holdings</h2><a class="btn btn-sm" href="#positions">All positions</a></div>' + SB.live('holdings5', v) + '</section>' +
      '<section class="card" aria-labelledby="p5"><h2 id="p5">Open orders</h2>' + SB.live('orders', v) + '</section>');
  };
  P.positions = function () {
    const v = pf();
    return SB.page('Account Positions', 'Every holding with its current value, cost basis and gain or loss. Prices update every few seconds while live prices are on.',
      resultBox() + '<div class="card row between wrap">' + acctPick('pf', v, 'Show') + '<button type="button" class="btn" data-act="copy-positions">Copy as CSV</button></div><div class="card">' + SB.live('positions', v) + '</div>');
  };

  /* ================= Trade ================= */
  SB.ticket = function (adv) {
    const pre = SB.ui.prefill || {}; SB.ui.prefill = null;
    const p = adv ? 'adv' : 'tk', stt = st();
    const types = adv ? [['market', 'Market'], ['limit', 'Limit'], ['stop', 'Stop'], ['stoplimit', 'Stop-limit']] : [['market', 'Market'], ['limit', 'Limit']];
    const acct = pre.acct || (SB.ui.pf && SB.ui.pf !== 'all' ? SB.ui.pf : stt.activeAcct);
    return '<form class="card ticket" data-form="ticket" data-init="ticket" data-adv="' + (adv ? 1 : 0) + '" novalidate aria-labelledby="' + p + '-h"><h2 id="' + p + '-h">' + (adv ? 'Advanced order ticket' : 'Order ticket') + '</h2>' +
      '<div class="form-grid">' +
      SB.field({ id: p + '-acct', name: 'acct', label: 'Account', options: SB.acctOptions(), value: acct }) +
      SB.field({ id: p + '-sym', name: 'sym', label: 'Symbol', hint: 'Try AAPL, SPY, FXAIX or UST10Y.', value: pre.sym || '', attrs: ' list="symlist" autocomplete="off" autocapitalize="characters" spellcheck="false" data-input="ticket"' }) +
      SB.radios('side', [['buy', 'Buy'], ['sell', 'Sell']], pre.side || 'buy', 'Action', 'inline') +
      SB.field({ id: p + '-type', name: 'type', label: 'Order type', options: types, value: 'market', attrs: ' data-change="ticket"' }) +
      SB.field({ id: p + '-mode', name: 'mode', label: 'Order by', options: [['qty', 'Shares / units'], ['dollars', 'Dollar amount']], value: 'qty', attrs: ' data-change="ticket"' }) +
      SB.field({ id: p + '-qty', name: 'qty', label: 'Quantity', type: 'number', attrs: ' min="0" step="any" inputmode="decimal" data-input="ticket"', hint: 'Bonds trade in $1,000 units.' }) +
      SB.field({ id: p + '-dollars', name: 'dollars', label: 'Amount in dollars', type: 'number', attrs: ' min="0" step="0.01" inputmode="decimal" data-input="ticket"', hint: 'Buys fractional shares at the current price.' }) +
      SB.field({ id: p + '-limit', name: 'limit', label: 'Limit price', type: 'number', attrs: ' min="0" step="any" inputmode="decimal" data-input="ticket"', hint: 'The worst price you will accept.' }) +
      SB.field({ id: p + '-stop', name: 'stop', label: 'Stop price', type: 'number', attrs: ' min="0" step="any" inputmode="decimal" data-input="ticket"', hint: 'The price that triggers your order.' }) +
      '</div><div class="ticket-info" data-ticket-info aria-live="off"></div><div class="form-err notice err" role="alert" hidden></div>' +
      '<div class="row wrap"><button type="submit" class="btn btn-accent">Preview order</button><button type="button" class="btn btn-ghost" data-act="ticket-reset">Clear</button></div>' +
      '<p class="muted small">$0 commissions. ' + (SB.dataMode === 'real' ? 'Practice orders use the latest real price. Stock and ETF orders fill only while the U.S. market is open (9:30 a.m.–4 p.m. Eastern); otherwise they wait until it opens. Mutual funds fill at the latest NAV.' : 'Simulated market orders fill instantly at the current simulated price; mutual funds fill at the simulated NAV.') + '</p></form>';
  };
  function show(f, name, on) { const el = f.elements[name]; if (!el) return; const w = el.closest('.field'); if (w) w.hidden = !on; el.disabled = !on; }
  SB.inits.ticket = function (f) {
    const g = function (n) { return f.elements[n]; };
    const sym = (g('sym').value || '').trim().toUpperCase(), s = SB.bySym[sym], type = g('type').value, mode = g('mode').value, side = f.elements.side.value;
    Array.prototype.forEach.call(g('type').options, function (o) { o.disabled = !!s && ((s.type === 'fund' && o.value !== 'market') || (s.type === 'bond' && (o.value === 'stop' || o.value === 'stoplimit'))); });
    if (g('type').options[g('type').selectedIndex].disabled) g('type').value = 'market';
    Array.prototype.forEach.call(g('mode').options, function (o) { o.disabled = !!s && s.type === 'bond' && o.value === 'dollars'; });
    if (g('mode').options[g('mode').selectedIndex].disabled) g('mode').value = 'qty';
    const t2 = g('type').value, m2 = g('mode').value;
    show(f, 'limit', t2 === 'limit' || t2 === 'stoplimit'); show(f, 'stop', t2 === 'stop' || t2 === 'stoplimit');
    show(f, 'dollars', m2 === 'dollars'); show(f, 'qty', m2 !== 'dollars');
    const box = f.querySelector('[data-ticket-info]'); let h = '';
    if (s) {
      const a = SB.acct(g('acct').value), pos = a.positions[s.sym];
      h += '<div class="quote-mini"><p><strong>' + esc(s.name) + '</strong> (' + s.sym + ') · ' + SB.TYPE[s.type] + '</p><p class="big">' + SB.pxText(s) + (s.type === 'bond' ? ' <span class="muted small">per $100 · $' + nf(s.price * 10, 2) + ' per bond</span>' : '') + ' ' + SB.quoteChg(s) + '</p><p class="muted small">' + (side === 'sell' ? 'Available to sell: ' + SB.qty(SB.availableQty(a, s.sym)) : 'Available cash: ' + money(SB.availableCash(a))) + (pos ? ' · You own ' + SB.qty(pos.qty) : '') + '</p></div>';
      const any = (m2 === 'dollars' ? +g('dollars').value : +g('qty').value) > 0;
      if (any) { const v = SB.validateOrder(SB.fd(f)); h += v.ok ? '<p class="est">Estimated ' + (side === 'buy' ? 'cost' : 'proceeds') + ': <strong>' + money(v.est) + '</strong> for ' + SB.qty(v.qty) + ' ' + (s.type === 'bond' ? 'bond(s)' : 'share(s)') + '</p>' : '<p class="hint-warn">' + esc(v.msg) + '</p>'; }
    } else if (sym) h = '<p class="hint-warn">No security found for “' + esc(sym) + '”. Use the suggestions in the symbol box.</p>';
    box.innerHTML = h;
  };
  IN['ticket'] = function (el) { const f = el.form; SB.clearErr(f); SB.inits.ticket(f); };
  CH['ticket'] = IN['ticket'];
  A['ticket-reset'] = function (el) { const f = el.closest('form'); f.reset(); SB.inits.ticket(f); SB.clearErr(f); };
  FM['ticket'] = function (f) {
    SB.clearErr(f); const d = SB.fd(f), v = SB.validateOrder(d);
    if (!v.ok) { SB.fail(f, v.msg); return; }
    SB.ui.pending = d;
    const s = v.s, a = v.a, units = s.type === 'bond' ? 'bond(s)' : 'share(s)';
    SB.dialog('Review your order',
      '<dl class="kv"><dt>Account</dt><dd>' + esc(a.name) + ' · ' + a.num + '</dd><dt>Action</dt><dd>' + (v.side === 'buy' ? 'Buy' : 'Sell') + '</dd><dt>Security</dt><dd>' + esc(s.name) + ' (' + s.sym + ')</dd><dt>Quantity</dt><dd>' + SB.qty(v.qty) + ' ' + units + '</dd><dt>Order type</dt><dd>' + esc(SB.describeOrder({ sym: s.sym, side: v.side, qty: v.qty, type: v.type, limit: v.limit, stop: v.stop }).split('— ')[1]) + '</dd><dt>Estimated ' + (v.side === 'buy' ? 'cost' : 'proceeds') + '</dt><dd><strong>' + money(v.est) + '</strong></dd><dt>Commission</dt><dd>$0.00</dd></dl>' +
      '<p class="muted small">This is a simulation. No real order is sent.</p><div class="row wrap"><button type="button" class="btn btn-accent" data-act="confirm-order">Place order</button><button type="button" class="btn" data-act="dlg-close">Edit order</button></div>');
  };
  A['confirm-order'] = function () {
    const r = SB.placeOrder(SB.ui.pending); SB.closeDialog();
    if (!r.ok) { SB.toast(r.msg, 'err'); SB.ui.result = r; SB.rerender(); return; }
    SB.ui.pending = null; SB.success(r);
  };
  P.trade = function () {
    const stt = st();
    return SB.page('Trade', 'Buy and sell stocks, ETFs, mutual funds and bonds. Need more order types? Try <a href="#advanced-trading">Advanced Trading</a>.',
      resultBox() + SB.ticket(false) + '<section class="card" aria-labelledby="t1"><h2 id="t1">Open orders</h2>' + SB.live('orders', 'all') + '</section><section class="card" aria-labelledby="t2"><h2 id="t2">Recent orders</h2>' + SB.live('recent', 'all') + '</section>');
  };

  /* ================= Transfers ================= */
  P.transfers = function () {
    const s = st(), list = SB.acctOptions({ bank: true });
    const hist = s.txns.filter(function (t) { return ['Deposit', 'Withdrawal', 'Transfer in', 'Transfer out'].indexOf(t.kind) > -1; }).slice(0, 10);
    const iras = s.accounts.filter(SB.isIRA);
    return SB.page('Transfers', 'Move money between your linked checking account and your SnowBall+ accounts.',
      resultBox() + '<div class="grid g2"><form class="card" data-form="transfer" novalidate aria-labelledby="tr1"><h2 id="tr1">Move money</h2>' +
      SB.field({ id: 'tr-from', name: 'from', label: 'From', options: list, value: 'bank' }) +
      SB.field({ id: 'tr-to', name: 'to', label: 'To', options: list, value: s.activeAcct }) +
      SB.field({ id: 'tr-amt', name: 'amount', label: 'Amount (USD)', type: 'number', attrs: ' min="0" step="0.01" inputmode="decimal" required' }) +
      '<div class="form-err notice err" role="alert" hidden></div><button class="btn btn-accent" type="submit">Submit transfer</button><p class="muted small">Transfers are instant in this simulation. Linked checking is a fictional account.</p></form>' +
      '<section class="card" aria-labelledby="tr2"><h2 id="tr2">Cash balances</h2><ul class="plain">' + s.accounts.map(function (a) { return '<li class="row between"><span>' + esc(a.name) + '<br><span class="muted small">' + a.num + '</span></span><strong>' + money(SB.availableCash(a)) + '</strong></li>'; }).join('') + '</ul>' +
      (iras.length ? '<h3>IRA contributions this year</h3>' + iras.map(function (a) { const c = a.contribYear === new Date().getFullYear() ? a.contrib : 0; return '<p class="small">' + esc(a.name) + ': ' + money(c, 0) + ' of ' + money(SB.IRA_LIMIT, 0) + ' (simulated limit)</p>' + SB.meter(c, SB.IRA_LIMIT, a.name + ' contributions'); }).join('') : '') + '</section></div>' +
      '<section class="card" aria-labelledby="tr3"><h2 id="tr3">Recent transfers</h2>' + (hist.length ? SB.tableWrap('Recent transfers', '<table class="tbl"><caption class="sr">Recent transfers</caption><thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Amount</th></tr></thead><tbody>' + hist.map(function (t) { return '<tr><td>' + SB.dateTime(t.ts) + '</td><td>' + esc(t.desc) + '<br><span class="muted small">' + esc(SB.acct(t.acct).name) + '</span></td><td class="num">' + (t.amount < 0 ? '−' : '+') + money(Math.abs(t.amount)) + '</td></tr>'; }).join('') + '</tbody></table>') : SB.empty('<p>No transfers yet.</p>')) + '</section>');
  };
  FM['transfer'] = function (f) { SB.clearErr(f); const d = SB.fd(f), r = SB.transfer(d); if (!r.ok) SB.fail(f, r.msg); else SB.success(r); };

  /* ================= Cash Management ================= */
  P.cash = function () {
    const s = st();
    const cards = s.accounts.map(function (a) {
      const rate = SB.RATES[a.sweep] || 0, yr = a.cash * rate / 100;
      return '<section class="card" aria-labelledby="c-' + a.id + '"><h2 id="c-' + a.id + '">' + esc(a.name) + ' <span class="muted small">' + a.num + '</span></h2><div class="grid g3">' + SB.tile('Cash balance', money(a.cash)) + SB.tile('Available to trade', money(SB.availableCash(a))) + SB.tile('Estimated interest', money(yr / 12) + ' / month', 'About ' + money(yr) + ' per year at ' + SB.pct(rate) + ' (simulated)') + '</div>' +
        SB.radios('sweep-' + a.id, [['mm', 'Money market fund (SNMM) — ' + SB.pct(SB.RATES.mm) + ' 7-day yield'], ['bank', 'Insured bank deposit sweep — ' + SB.pct(SB.RATES.bank)]], a.sweep, 'Where should uninvested cash go in this account?') + '</section>';
    }).join('');
    return SB.page('Cash Management', 'Choose where uninvested cash is held and see the interest it could earn. Rates are simulated and change nothing outside this app.', resultBox() + cards +
      '<form class="card" data-form="whatif" data-init="whatif" aria-labelledby="c-w"><h2 id="c-w">What if I held more cash?</h2>' + SB.field({ id: 'wi-amt', name: 'amt', label: 'Cash balance (USD)', type: 'number', value: '10000', attrs: ' min="0" step="100" inputmode="decimal" data-input="whatif"' }) + '<div data-whatif-out></div></form>');
  };
  CH['sweep'] = function (el) { const id = el.name.replace('sweep-', ''); SB.acct(id).sweep = el.value; SB.save(); SB.toast('Cash sweep updated.', 'ok'); SB.rerender(); };
  SB.inits.whatif = function (f) {
    const v = Math.max(0, +f.elements.amt.value || 0), out = f.querySelector('[data-whatif-out]');
    out.innerHTML = SB.tableWrap('Interest comparison', '<table class="tbl"><caption class="sr">Estimated interest by option</caption><thead><tr><th scope="col">Option</th><th scope="col">Rate</th><th scope="col">Per month</th><th scope="col">Per year</th></tr></thead><tbody>' +
      [['Money market fund (SNMM)', SB.RATES.mm], ['Insured bank deposit sweep', SB.RATES.bank]].map(function (r) { return '<tr><th scope="row">' + r[0] + '</th><td class="num">' + SB.pct(r[1]) + '</td><td class="num">' + money(v * r[1] / 1200) + '</td><td class="num">' + money(v * r[1] / 100) + '</td></tr>'; }).join('') + '</tbody></table>');
  };
  IN['whatif'] = function (el) { SB.inits.whatif(el.form); };

  /* ================= Bill Pay ================= */
  P.billpay = function () {
    const s = st(), pay = s.payees.map(function (p) { return [p.name, p.name]; });
    const bills = s.bills.slice(0, 12);
    return SB.page('Bill Pay', 'Pay bills from the cash in your accounts. Scheduled payments are made automatically on their date while you use the app.',
      resultBox() + '<div class="grid g2"><form class="card" data-form="bill" novalidate aria-labelledby="b1"><h2 id="b1">Make a payment</h2>' +
      SB.field({ id: 'bp-acct', name: 'acct', label: 'Pay from', options: SB.acctOptions(), value: s.activeAcct }) +
      SB.field({ id: 'bp-payee', name: 'payee', label: 'Payee', options: pay.length ? pay : [['', 'Add a payee first']] }) +
      SB.field({ id: 'bp-amt', name: 'amount', label: 'Amount (USD)', type: 'number', attrs: ' min="0" step="0.01" inputmode="decimal" required' }) +
      SB.field({ id: 'bp-date', name: 'date', label: 'Payment date', type: 'date', value: SB.todayStr(), attrs: ' min="' + SB.todayStr() + '"' }) +
      SB.field({ id: 'bp-memo', name: 'memo', label: 'Memo (optional)', attrs: ' maxlength="40"' }) +
      '<div class="form-err notice err" role="alert" hidden></div><button type="submit" class="btn btn-accent">Pay bill</button></form>' +
      '<div class="stack"><form class="card" data-form="payee" novalidate aria-labelledby="b2"><h2 id="b2">Payees</h2><ul class="plain">' + s.payees.map(function (p) { return '<li class="row between"><span>' + esc(p.name) + '</span><button type="button" class="btn btn-sm btn-ghost" data-act="rm-payee" data-id="' + p.id + '">Remove<span class="sr"> ' + esc(p.name) + '</span></button></li>'; }).join('') + '</ul>' +
      SB.field({ id: 'bp-new', name: 'name', label: 'Add a payee', attrs: ' maxlength="40" required' }) + '<div class="form-err notice err" role="alert" hidden></div><button type="submit" class="btn">Add payee</button></form></div></div>' +
      '<section class="card" aria-labelledby="b3"><h2 id="b3">Payment activity</h2>' + (bills.length ? SB.tableWrap('Payment activity', '<table class="tbl"><caption class="sr">Bill payments</caption><thead><tr><th scope="col">Date</th><th scope="col">Payee</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>' + bills.map(function (b) {
        return '<tr><td>' + b.date + '</td><td>' + esc(b.payee) + (b.memo ? '<br><span class="muted small">' + esc(b.memo) + '</span>' : '') + '</td><td class="num">' + money(b.amount) + '</td><td>' + SB.badge(b.status.charAt(0).toUpperCase() + b.status.slice(1), b.status) + (b.reason ? '<br><span class="muted small">' + esc(b.reason) + '</span>' : '') + '</td><td>' + (b.status === 'scheduled' ? '<button type="button" class="btn btn-sm" data-act="cancel-bill" data-id="' + b.id + '">Cancel</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>') : SB.empty('<p>No payments yet.</p>')) + '</section>');
  };
  FM['bill'] = function (f) { SB.clearErr(f); const r = SB.payBill(SB.fd(f)); if (!r.ok) SB.fail(f, r.msg); else SB.success(r); };
  FM['payee'] = function (f) { SB.clearErr(f); const n = (SB.fd(f).name || '').trim(); if (!n) { SB.fail(f, 'Enter a payee name.'); return; } st().payees.push({ id: SB.uid('p'), name: n }); SB.save(); SB.success({ ok: true, msg: n + ' added as a payee.' }); };
  A['rm-payee'] = function (el) { const s = st(); s.payees = s.payees.filter(function (p) { return p.id !== el.dataset.id; }); SB.save(); SB.rerender(); };
  A['cancel-bill'] = function (el) { const b = st().bills.find(function (x) { return x.id === el.dataset.id; }); if (b) { b.status = 'cancelled'; SB.save(); SB.toast('Scheduled payment cancelled.', 'info'); SB.rerender(); } };

  /* ================= Full View ================= */
  P.fullview = function () {
    const s = st(), mine = SB.sumValue(s.accounts), ext = s.external, assets = ext.filter(function (e) { return e.kind === 'asset'; }).reduce(function (t, e) { return t + e.value; }, 0), liab = ext.filter(function (e) { return e.kind === 'liability'; }).reduce(function (t, e) { return t + e.value; }, 0);
    const net = mine + assets - liab;
    const items = [{ label: 'SnowBall+ accounts', value: mine }].concat(ext.filter(function (e) { return e.kind === 'asset'; }).map(function (e) { return { label: e.name, value: e.value }; }));
    return SB.page('Full View', 'See everything in one place: your SnowBall+ accounts plus outside accounts you add by hand. Outside accounts are simulated and are never connected to a real bank.',
      resultBox() + '<div class="grid g3">' + SB.tile('Net worth', money(net)) + SB.tile('Total assets', money(mine + assets), 'Includes ' + money(mine, 0) + ' at SnowBall+') + SB.tile('Total liabilities', money(liab)) + '</div>' +
      '<div class="grid g2"><section class="card" aria-labelledby="fv1"><h2 id="fv1">Where your assets are</h2>' + SB.donut(items, { center: 'Assets' }) + '</section>' +
      '<form class="card" data-form="external" novalidate aria-labelledby="fv2"><h2 id="fv2">Add an outside account</h2>' + SB.field({ id: 'fv-name', name: 'name', label: 'Name', attrs: ' maxlength="40" required' }) + SB.field({ id: 'fv-kind', name: 'kind', label: 'Type', options: [['asset', 'Asset (money you have)'], ['liability', 'Liability (money you owe)']] }) + SB.field({ id: 'fv-val', name: 'value', label: 'Balance (USD)', type: 'number', attrs: ' min="0" step="0.01" inputmode="decimal" required' }) + '<div class="form-err notice err" role="alert" hidden></div><button class="btn btn-accent" type="submit">Add account</button></form></div>' +
      '<section class="card" aria-labelledby="fv3"><h2 id="fv3">All accounts</h2>' + SB.tableWrap('All accounts', '<table class="tbl"><caption class="sr">All accounts and balances</caption><thead><tr><th scope="col">Account</th><th scope="col">Type</th><th scope="col">Balance</th><th scope="col">Action</th></tr></thead><tbody>' +
        s.accounts.map(function (a) { return '<tr><th scope="row">' + esc(a.name) + '<br><span class="muted small">' + a.num + '</span></th><td>' + SB.ACCT_TYPES[a.type] + '</td><td class="num">' + money(SB.acctValue(a)) + '</td><td><a class="btn btn-sm" href="#positions" data-acct="' + a.id + '">View</a></td></tr>'; }).join('') +
        ext.map(function (e) { return '<tr><th scope="row">' + esc(e.name) + '</th><td>' + (e.kind === 'asset' ? 'Outside asset' : 'Liability') + '</td><td class="num">' + (e.kind === 'liability' ? '−' : '') + money(e.value) + '</td><td><button type="button" class="btn btn-sm btn-ghost" data-act="rm-ext" data-id="' + e.id + '">Remove<span class="sr"> ' + esc(e.name) + '</span></button></td></tr>'; }).join('') + '</tbody></table>') + '</section>');
  };
  FM['external'] = function (f) { SB.clearErr(f); const d = SB.fd(f), v = +d.value; if (!(d.name || '').trim()) { SB.fail(f, 'Enter a name.'); return; } if (!(v >= 0) || d.value === '') { SB.fail(f, 'Enter a balance of zero or more.'); return; } st().external.push({ id: SB.uid('x'), name: d.name.trim(), kind: d.kind === 'liability' ? 'liability' : 'asset', value: SB.r2(v) }); SB.save(); SB.success({ ok: true, msg: d.name.trim() + ' added to Full View.' }); };
  A['rm-ext'] = function (el) { const s = st(); s.external = s.external.filter(function (e) { return e.id !== el.dataset.id; }); SB.save(); SB.rerender(); };

  /* ================= Security Settings ================= */
  function sw(key, label, desc) { return '<label class="switch"><input type="checkbox" data-change="pref" data-key="' + key + '"' + (st().prefs[key] ? ' checked' : '') + '><span><strong>' + label + '</strong><br><span class="muted small">' + desc + '</span></span></label>'; }
  P.security = function () {
    const p = st().prefs;
    return SB.page('Security Settings', 'Protect your simulated account and tailor how SnowBall+ looks and behaves.', resultBox() +
      '<div class="grid g2"><section class="card" aria-labelledby="se1"><h2 id="se1">Sign-in &amp; alerts</h2>' + sw('twoFA', 'Two-step verification', 'Ask for a code when signing in on a new device (simulated).') + sw('alertOrders', 'Order alerts', 'Notify me when an order fills.') + sw('alertPrice', 'Price alerts', 'Notify me of large moves in my holdings.') + sw('alertNews', 'News alerts', 'Notify me when news mentions my watchlist.') +
      SB.field({ id: 'se-to', label: 'Sign out after inactivity', options: [['5', '5 minutes'], ['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 hour']], value: p.timeout, attrs: ' data-change="pref" data-key="timeout"' }) + '</section>' +
      '<section class="card" aria-labelledby="se2"><h2 id="se2">Display &amp; accessibility</h2>' + sw('hc', 'High-contrast mode', 'Stronger borders and text colors.') + sw('live', 'Live price updates', 'Turn off to freeze prices and stop automatic page updates.') +
      '<div class="field"><span class="label-like" id="fs-l">Text size</span><div class="row"><button type="button" class="btn" data-act="fs-down" aria-label="Decrease text size">A−</button><output aria-live="polite" aria-labelledby="fs-l">' + Math.round(p.fs * 100) + '%</output><button type="button" class="btn" data-act="fs-up" aria-label="Increase text size">A+</button><button type="button" class="btn btn-ghost" data-act="fs-reset">Reset</button></div></div></section></div>' +
      '<section class="card" aria-labelledby="se3"><h2 id="se3">Trusted devices</h2><ul class="plain">' + p.devices.map(function (d, i) { return '<li class="row between"><span>' + esc(d) + '</span>' + (i ? '<button type="button" class="btn btn-sm" data-act="rm-device" data-i="' + i + '">Remove<span class="sr"> ' + esc(d) + '</span></button>' : '<span class="badge">This device</span>') + '</li>'; }).join('') + '</ul></section>' +
      '<section class="card" aria-labelledby="se4"><h2 id="se4">Your data</h2><p>Everything in SnowBall+ is stored in this browser only. Export it for a backup, or reset the simulator to start over.</p><div class="row wrap"><button type="button" class="btn" data-act="copy-data">Copy my data (JSON)</button><button type="button" class="btn btn-danger" data-act="reset-ask">Reset simulator…</button></div></section>');
  };
  CH['pref'] = function (el) { const k = el.dataset.key; st().prefs[k] = el.type === 'checkbox' ? el.checked : el.value; SB.save(); SB.applyPrefs(); if (k === 'live') SB.toast(el.checked ? 'Live prices are on.' : 'Live prices are paused.', 'info'); };
  A['fs-up'] = function () { const p = st().prefs; p.fs = Math.min(1.4, Math.round((p.fs + 0.1) * 10) / 10); SB.save(); SB.applyPrefs(); SB.rerender(); };
  A['fs-down'] = function () { const p = st().prefs; p.fs = Math.max(0.9, Math.round((p.fs - 0.1) * 10) / 10); SB.save(); SB.applyPrefs(); SB.rerender(); };
  A['fs-reset'] = function () { st().prefs.fs = 1; SB.save(); SB.applyPrefs(); SB.rerender(); };
  A['rm-device'] = function (el) { st().prefs.devices.splice(+el.dataset.i, 1); SB.save(); SB.rerender(); };
  A['copy-data'] = function () { SB.copy(SB.exportJSON()).then(function (ok) { SB.toast(ok ? 'Data copied to your clipboard.' : 'Copy is not available in this browser.', ok ? 'ok' : 'err'); }); };
  A['reset-ask'] = function () { SB.dialog('Reset the simulator?', '<p>This erases your accounts, orders and settings in this browser and restores the starting portfolio. It cannot be undone.</p><div class="row wrap"><button type="button" class="btn btn-danger" data-act="reset-go">Yes, reset everything</button><button type="button" class="btn" data-act="dlg-close">Keep my data</button></div>'); };
  A['reset-go'] = function () { SB.closeDialog(); SB.reset(); SB.applyPrefs(); SB.buildAcctSwitch(); SB.toast('Simulator reset.', 'ok'); SB.go('home'); };

  /* ================= Account Features ================= */
  P.features = function () {
    const s = st();
    const feat = s.accounts.map(function (a) {
      const f = a.features;
      const tg = function (k, l, d) { return '<label class="switch"><input type="checkbox" data-change="feat" data-acct="' + a.id + '" data-key="' + k + '"' + (f[k] ? ' checked' : '') + '><span><strong>' + l + '</strong><br><span class="muted small">' + d + '</span></span></label>'; };
      const bn = s.beneficiaries.filter(function (b) { return b.acct === a.id; }), sumP = bn.reduce(function (t, b) { return t + b.pct; }, 0);
      return '<section class="card" aria-labelledby="f-' + a.id + '"><h2 id="f-' + a.id + '">' + esc(a.name) + ' <span class="muted small">' + a.num + '</span></h2><div class="grid g2"><div>' +
        tg('drip', 'Dividend reinvestment (DRIP)', 'Automatically buy more shares with dividends.') + tg('checks', 'Check writing', 'Write checks against cash in this account.') + tg('margin', 'Margin (simulated)', 'Borrow against holdings. Interest ' + SB.pct(SB.RATES.margin) + '.') + tg('paperless', 'Paperless documents', 'View statements and confirmations online.') + tg('extended', 'Extended-hours trading', 'Place orders before and after regular hours.') +
        SB.field({ id: 'op-' + a.id, label: 'Options trading level', options: [['none', 'Not enabled'], ['1', 'Level 1 — covered strategies'], ['2', 'Level 2 — buy calls and puts']], value: f.options, attrs: ' data-change="feat" data-acct="' + a.id + '" data-key="options"' }) +
        '<p class="muted small">Options trading is a placeholder setting; options orders are not part of this simulator.</p></div><div><h3>Beneficiaries</h3>' +
        (bn.length ? '<ul class="plain">' + bn.map(function (b) { return '<li class="row between"><span>' + esc(b.name) + ' <span class="muted small">(' + esc(b.rel) + ')</span> — ' + b.pct + '%</span><button type="button" class="btn btn-sm btn-ghost" data-act="rm-ben" data-id="' + b.id + '">Remove<span class="sr"> ' + esc(b.name) + '</span></button></li>'; }).join('') + '</ul><p class="small ' + (sumP === 100 ? '' : 'warn-text') + '">Total: ' + sumP + '% ' + (sumP === 100 ? '✓ complete' : '— should add up to 100%') + '</p>' : '<p class="muted">No beneficiaries named yet.</p>') +
        '<form data-form="ben" data-acct="' + a.id + '" novalidate><div class="form-grid">' + SB.field({ id: 'bn-' + a.id, name: 'name', label: 'Name', attrs: ' maxlength="40" required' }) + SB.field({ id: 'br-' + a.id, name: 'rel', label: 'Relationship', attrs: ' maxlength="30"' }) + SB.field({ id: 'bp-' + a.id, name: 'pct', label: 'Share (%)', type: 'number', attrs: ' min="1" max="100" step="1" required' }) + '</div><div class="form-err notice err" role="alert" hidden></div><button class="btn btn-sm" type="submit">Add beneficiary</button></form></div></div>' +
        '<div class="row wrap"><button type="button" class="btn" data-act="divs" data-acct="' + a.id + '">Simulate a quarterly payout</button><span class="muted small">Pays dividends and bond interest on current holdings, reinvesting if DRIP is on.</span></div></section>';
    }).join('');
    return SB.page('Account Features', 'Turn account services on or off for each account.', resultBox() + feat);
  };
  CH['feat'] = function (el) { const a = SB.acct(el.dataset.acct), k = el.dataset.key; a.features[k] = el.type === 'checkbox' ? el.checked : el.value; SB.save(); SB.toast('Setting saved.', 'ok'); };
  A['divs'] = function (el) { const r = SB.payDividends(el.dataset.acct); SB.success(r); };
  FM['ben'] = function (f) {
    SB.clearErr(f); const d = SB.fd(f), id = f.dataset.acct, pct = Math.round(+d.pct);
    if (!(d.name || '').trim()) { SB.fail(f, 'Enter the beneficiary’s name.'); return; } if (!(pct >= 1 && pct <= 100)) { SB.fail(f, 'Enter a share between 1 and 100.'); return; }
    const cur = st().beneficiaries.filter(function (b) { return b.acct === id; }).reduce(function (t, b) { return t + b.pct; }, 0);
    if (cur + pct > 100) { SB.fail(f, 'Shares cannot exceed 100% (currently ' + cur + '%).'); return; }
    st().beneficiaries.push({ id: SB.uid('b'), acct: id, name: d.name.trim(), rel: (d.rel || '').trim() || 'Beneficiary', pct: pct }); SB.save(); SB.success({ ok: true, msg: d.name.trim() + ' added as a beneficiary.' });
  };
  A['rm-ben'] = function (el) { const s = st(); s.beneficiaries = s.beneficiaries.filter(function (b) { return b.id !== el.dataset.id; }); SB.save(); SB.rerender(); };

  /* ================= Documents ================= */
  function confText(o) {
    const s = SB.bySym[o.sym], a = SB.acct(o.acct);
    return 'TRADE CONFIRMATION (SIMULATED — NOT A REAL DOCUMENT)\n\nAccount:      ' + a.name + ' ' + a.num + '\nAction:       ' + (o.side === 'buy' ? 'Bought' : 'Sold') + '\nSecurity:     ' + s.name + ' (' + s.sym + ')\nQuantity:     ' + SB.qty(o.qty) + '\nPrice:        ' + SB.priceStr(s, o.fillPrice) + '\nOrder type:   ' + SB.describeOrder(o).split('— ')[1] + '\nExecuted:     ' + SB.dateTime(o.filled) + '\nCommission:   $0.00\nTotal:        ' + money(o.total) + (o.realized != null ? '\nRealized P/L: ' + money(o.realized) : '') + '\nOrder ID:     ' + o.id;
  }
  A['view-conf'] = function (el) { const o = st().orders.find(function (x) { return x.id === el.dataset.id; }); if (o) SB.dialog('Trade confirmation', '<pre class="doc" tabindex="0">' + esc(confText(o)) + '</pre><div class="row wrap"><button type="button" class="btn" data-act="copy-text" data-text="' + esc(confText(o)) + '">Copy text</button><button type="button" class="btn btn-ghost" data-act="dlg-close">Close</button></div>'); };
  A['copy-text'] = function (el) { SB.copy(el.dataset.text).then(function (ok) { SB.toast(ok ? 'Copied.' : 'Copy is not available in this browser.', ok ? 'ok' : 'err'); }); };
  function monthList() { const out = [], d = new Date(); for (let i = 0; i < 3; i++) { out.push(new Date(d.getFullYear(), d.getMonth() - i, 1)); } return out; }
  A['view-stmt'] = function (el) {
    const m0 = new Date(+el.dataset.y, +el.dataset.m, 1), m1 = new Date(+el.dataset.y, +el.dataset.m + 1, 1), v = pf();
    const tx = st().txns.filter(function (t) { return t.ts >= m0.getTime() && t.ts < m1.getTime() && (v === 'all' || t.acct === v); });
    const inflow = tx.filter(function (t) { return t.amount > 0; }).reduce(function (s, t) { return s + t.amount; }, 0), outflow = tx.filter(function (t) { return t.amount < 0; }).reduce(function (s, t) { return s + t.amount; }, 0);
    SB.dialog('Statement — ' + m0.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), '<p class="muted small">Simulated activity summary for ' + (v === 'all' ? 'all accounts' : esc(SB.acct(v).name)) + '.</p><dl class="kv"><dt>Money in</dt><dd>' + money(inflow) + '</dd><dt>Money out</dt><dd>' + money(Math.abs(outflow)) + '</dd><dt>Transactions</dt><dd>' + tx.length + '</dd></dl>' + (tx.length ? txTable(tx.slice(0, 40)) : '<p>No activity this month.</p>') + '<button type="button" class="btn" data-act="dlg-close">Close</button>');
  };
  function txTable(list) {
    return SB.tableWrap('Account activity', '<table class="tbl"><caption class="sr">Account activity</caption><thead><tr><th scope="col">Date</th><th scope="col">Account</th><th scope="col">Activity</th><th scope="col">Amount</th></tr></thead><tbody>' + list.map(function (t) { return '<tr><td>' + SB.dateStr(t.ts) + '</td><td>' + esc(SB.acct(t.acct).name) + '</td><td>' + esc(t.desc) + '</td><td class="num">' + (t.amount === 0 ? '—' : (t.amount < 0 ? '−' : '+') + money(Math.abs(t.amount))) + '</td></tr>'; }).join('') + '</tbody></table>');
  }
  A['doc-tab'] = function (el) { SB.ui.doc = el.dataset.v; SB.rerender(); };
  A['copy-activity'] = function () { const v = pf(), l = st().txns.filter(function (t) { return v === 'all' || t.acct === v; }); SB.copy(SB.csv([['Date', 'Account', 'Activity', 'Amount']].concat(l.map(function (t) { return [new Date(t.ts).toISOString().slice(0, 10), SB.acct(t.acct).name, t.desc, t.amount.toFixed(2)]; })))).then(function (ok) { SB.toast(ok ? 'Activity copied as CSV.' : 'Copy is not available in this browser.', ok ? 'ok' : 'err'); }); };
  P.documents = function () {
    const tab = SB.ui.doc || 'conf', v = pf(); let body = '';
    if (tab === 'conf') {
      const l = st().orders.filter(function (o) { return o.status === 'filled' && (v === 'all' || o.acct === v); }).slice(0, 25);
      body = l.length ? SB.tableWrap('Trade confirmations', '<table class="tbl"><caption class="sr">Trade confirmations</caption><thead><tr><th scope="col">Date</th><th scope="col">Trade</th><th scope="col">Total</th><th scope="col">Document</th></tr></thead><tbody>' + l.map(function (o) { return '<tr><td>' + SB.dateTime(o.filled) + '</td><td>' + esc(SB.describeOrder(o)) + '</td><td class="num">' + money(o.total) + '</td><td><button type="button" class="btn btn-sm" data-act="view-conf" data-id="' + o.id + '">View<span class="sr"> confirmation for ' + o.sym + '</span></button></td></tr>'; }).join('') + '</tbody></table>') : SB.empty('<p>Confirmations appear here after you place a trade.</p><p><a class="btn btn-primary" href="#trade">Go to Trade</a></p>');
    } else if (tab === 'stmt') {
      body = '<ul class="plain">' + monthList().map(function (d) { return '<li class="row between"><span>' + d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' statement</span><button type="button" class="btn btn-sm" data-act="view-stmt" data-y="' + d.getFullYear() + '" data-m="' + d.getMonth() + '">View<span class="sr"> ' + d.toLocaleDateString('en-US', { month: 'long' }) + ' statement</span></button></li>'; }).join('') + '</ul>';
    } else {
      const l = st().txns.filter(function (t) { return v === 'all' || t.acct === v; }).slice(0, 50);
      body = '<div class="row between wrap"><p class="muted">Showing the latest ' + l.length + ' transactions.</p><button type="button" class="btn" data-act="copy-activity">Copy as CSV</button></div>' + txTable(l);
    }
    return SB.page('Documents', 'Trade confirmations, statements and account activity. Simulated documents are for practice only.', resultBox() + '<div class="card row between wrap">' + acctPick('pf', v, 'Show') + SB.seg('doc-tab', [['conf', 'Trade confirmations'], ['stmt', 'Statements'], ['act', 'Account activity']], tab, 'Document type') + '</div><div class="card">' + body + '</div>');
  };

  /* ================= Retirement Distributions ================= */
  P.distributions = function () {
    const s = st(), iras = s.accounts.filter(SB.isIRA);
    if (!iras.length) return SB.page('Retirement Distributions', 'Take money out of an IRA and estimate your required minimum distribution.', SB.empty('<p>You do not have an IRA yet. Open one to practice contributions and distributions.</p><p><a class="btn btn-primary" href="#retirement-accounts">Open a retirement account</a></p>'));
    const a = SB.acct(SB.ui.ira && iras.some(function (x) { return x.id === SB.ui.ira; }) ? SB.ui.ira : iras[0].id), ytd = SB.ytdDistributions(a.id);
    return SB.page('Retirement Distributions', 'Take money out of an IRA and estimate your required minimum distribution (RMD). Estimates use a simplified IRS table and are not tax advice.',
      resultBox() + '<div class="card">' + SB.field({ id: 'ira-sel', label: 'IRA', options: iras.map(function (x) { return [x.id, x.name + ' · ' + x.num]; }), value: a.id, attrs: ' data-change="ira-sel"' }) + '<div class="grid g3">' + SB.tile('Account value', money(SB.acctValue(a))) + SB.tile('Cash available', money(SB.availableCash(a))) + SB.tile('Distributed this year', money(ytd)) + '</div></div>' +
      '<div class="grid g2"><form class="card" data-form="rmd" data-init="rmd" aria-labelledby="d1"><h2 id="d1">RMD estimate</h2>' + (a.type === 'roth' ? SB.notice('Roth IRAs do not require withdrawals during the owner’s lifetime.', 'info') : '') +
      SB.field({ id: 'rm-born', name: 'born', label: 'Birth year', type: 'number', value: new Date().getFullYear() - 74, attrs: ' min="1920" max="' + new Date().getFullYear() + '" data-input="rmd"' }) +
      SB.field({ id: 'rm-bal', name: 'bal', label: 'Prior year-end balance (USD)', type: 'number', value: Math.round(SB.acctValue(a)), attrs: ' min="0" step="1" data-input="rmd"', hint: 'Defaults to the current value for practice.' }) + '<div data-rmd-out aria-live="polite"></div></form>' +
      '<form class="card" data-form="dist" novalidate aria-labelledby="d2"><h2 id="d2">Request a distribution</h2><input type="hidden" name="acct" value="' + a.id + '">' +
      SB.field({ id: 'di-amt', name: 'amount', label: 'Amount (USD)', type: 'number', attrs: ' min="0" step="0.01" inputmode="decimal" required' }) + SB.field({ id: 'di-wh', name: 'withhold', label: 'Federal tax withholding (%)', type: 'number', value: '10', attrs: ' min="0" max="50" step="1"', hint: 'Choose 0 to 50. Withholding is simulated.' }) +
      '<div class="form-err notice err" role="alert" hidden></div><button class="btn btn-accent" type="submit">Request distribution</button><p class="muted small">Funds go to your fictional linked checking account. To free up cash, sell holdings first.</p></form></div>');
  };
  CH['ira-sel'] = function (el) { SB.ui.ira = el.value; SB.rerender(); };
  SB.inits.rmd = function (f) {
    const born = +f.elements.born.value, bal = +f.elements.bal.value || 0, yr = new Date().getFullYear(), age = yr - born, start = born <= 1959 ? 73 : 75, out = f.querySelector('[data-rmd-out]');
    if (!born) { out.innerHTML = ''; return; }
    if (age < start) { out.innerHTML = SB.notice('Based on a birth year of ' + born + ', your RMDs would start at age ' + start + ' (about ' + (born + start) + '). You are ' + age + ' now, so no RMD is required this year.', 'info'); return; }
    const k = Math.min(90, age), factor = SB.RMD[k] || 12.2, rmd = bal / factor;
    out.innerHTML = '<dl class="kv"><dt>Age this year</dt><dd>' + age + '</dd><dt>Distribution period</dt><dd>' + factor + '</dd><dt>Estimated RMD</dt><dd><strong>' + money(rmd) + '</strong></dd></dl><p class="muted small">Simplified Uniform Lifetime Table (ages above 90 use the age-90 factor). Confirm the amount with the IRS or a tax professional.</p>';
  };
  IN['rmd'] = function (el) { SB.inits.rmd(el.form); };
  FM['rmd'] = function () { };
  FM['dist'] = function (f) { SB.clearErr(f); const r = SB.distribute(SB.fd(f)); if (!r.ok) SB.fail(f, r.msg); else SB.success(r); };

  /* ================= Refer a Friend ================= */
  P.refer = function () {
    const r = st().referral, msg = 'Join me on SnowBall+, a simulator for practicing investing. Use my code ' + r.code + '.';
    return SB.page('Refer a Friend', 'Invite a friend to practice investing. In this simulator, each friend who joins earns you a $25 practice bonus.', resultBox() +
      '<div class="grid g2"><section class="card" aria-labelledby="r1"><h2 id="r1">Your referral code</h2><p class="code" aria-label="Referral code ' + esc(r.code) + '">' + esc(r.code) + '</p><textarea class="input" rows="3" readonly aria-label="Invitation message">' + esc(msg) + '</textarea><div class="row wrap"><button type="button" class="btn btn-primary" data-act="copy-text" data-text="' + esc(msg) + '">Copy invitation</button><button type="button" class="btn" data-act="ref-sim">Simulate a friend joining</button></div></section>' +
      '<section class="card" aria-labelledby="r2"><h2 id="r2">Your referrals</h2><div class="grid g2">' + SB.tile('Friends joined', String(r.joined)) + SB.tile('Practice bonus earned', money(r.joined * 25)) + '</div><p class="muted small">Bonuses are added to your active account’s cash. No real invitations are sent from this simulator.</p></section></div>');
  };
  A['ref-sim'] = function () { const s = st(), a = SB.acct(); s.referral.joined++; a.cash = SB.r2(a.cash + 25); s.txns.unshift({ id: SB.uid('t'), ts: Date.now(), acct: a.id, kind: 'Referral bonus', amount: 25, desc: 'Referral bonus (simulated)' }); SB.save(); SB.success({ ok: true, msg: 'A friend joined! $25.00 was added to ' + a.name + '.' }); };
})();
