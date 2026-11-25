/* SnowBall+ — state, trading engine and price simulation. */
(function () {
  'use strict';
  const SB = window.SB;
  const KEY = 'snowballplus.v1';
  let state = null;
  const listeners = {};
  SB.on = function (e, f) { (listeners[e] = listeners[e] || []).push(f); };
  SB.emit = function (e, d) { (listeners[e] || []).forEach(function (f) { try { f(d); } catch (err) { console.error(err); } }); };
  const uid = function (p) { return p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); };
  const r2 = function (x) { return Math.round(x * 100) / 100; };
  const r4 = function (x) { return Math.round(x * 10000) / 10000; };
  SB.uid = uid; SB.r2 = r2;
  SB.ACCT_TYPES = { brokerage: 'Individual brokerage', roth: 'Roth IRA', trad: 'Traditional IRA', custodial: 'Custodial account (UTMA)' };
  SB.isIRA = function (a) { return a.type === 'roth' || a.type === 'trad'; };
  const DAY = 86400000;

  function acctNum() { return 'Z' + Math.floor(10 + Math.random() * 89) + '-' + Math.floor(100000 + Math.random() * 899999); }
  function newAcct(type, name) {
    return { id: uid('A'), name: name || SB.ACCT_TYPES[type], type: type, num: acctNum(), cash: 0, sweep: 'mm', positions: {}, contrib: 0,
      features: { drip: true, checks: false, margin: false, options: 'none', paperless: true, extended: false } };
  }

  function defaultState() {
    const a = newAcct('brokerage', 'Individual brokerage');
    a.id = 'A1'; a.num = 'Z12-345678'; a.cash = 12480.55; a.features.checks = true;
    const seed = [['AAPL', 20, 0.88], ['FXAIX', 50, 0.93], ['BND', 40, 0.99], ['SPY', 10, 0.95], ['UST2Y', 3, 0.995]];
    const txns = []; let invested = 0;
    seed.forEach(function (x, i) {
      const s = SB.bySym[x[0]], cost = SB.unitAt(s, s.price) * x[2] * x[1];
      a.positions[x[0]] = { qty: x[1], cost: cost }; invested += cost;
      txns.push({ id: uid('t'), ts: Date.now() - (50 - i * 7) * DAY, acct: 'A1', kind: 'Bought', sym: x[0], qty: x[1], price: SB.unitAt(s, s.price) * x[2] / (s.type === 'bond' ? 10 : 1), amount: -cost, desc: 'Bought ' + x[1] + ' ' + x[0] });
    });
    txns.push({ id: uid('t'), ts: Date.now() - 60 * DAY, acct: 'A1', kind: 'Deposit', amount: r2(a.cash + invested), desc: 'Deposit from linked checking (simulated)' });
    const yr = new Date().getFullYear();
    return {
      v: 1, activeAcct: 'A1', accounts: [a], orders: [], txns: txns.sort(function (x, y) { return y.ts - x.ts; }),
      watch: ['AAPL', 'MSFT', 'NVDA', 'SPY', 'FXAIX', 'UST10Y'],
      external: [
        { id: uid('x'), name: 'Checking account (linked bank)', kind: 'asset', value: 8200 },
        { id: uid('x'), name: 'Savings account', kind: 'asset', value: 5000 },
        { id: uid('x'), name: 'Credit card balance', kind: 'liability', value: 1450 }
      ],
      payees: [{ id: uid('p'), name: 'City Electric & Gas' }, { id: uid('p'), name: 'Campus Housing Office' }, { id: uid('p'), name: 'Mobile Carrier' }],
      bills: [], beneficiaries: [], meetings: [], referral: { code: 'SNOW-' + Math.random().toString(36).slice(2, 7).toUpperCase(), joined: 0 },
      goals: [{ id: uid('g'), name: 'Emergency fund', target: 15000, year: yr + 2, saved: 3000, monthly: 300 }],
      prefs: { fs: 1, live: true, hc: false, twoFA: true, alertPrice: true, alertOrders: true, alertNews: false, timeout: '15', devices: ['This browser (current)', 'Phone (trusted)'], edu: {} }
    };
  }

  SB.load = function () {
    let s = null;
    try { const raw = window.localStorage.getItem(KEY); if (raw) { s = JSON.parse(raw); if (!s || s.v !== 1 || !s.accounts || !s.accounts.length) s = null; } } catch (e) { s = null; }
    state = s || defaultState();
    state.prefs = Object.assign(defaultState().prefs, state.prefs || {});
    SB.processBills();
    return state;
  };
  let saveT = null;
  SB.save = function () {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try { state.orders = state.orders.slice(0, 200); state.txns = state.txns.slice(0, 600); window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable: keep going in memory */ }
    }, 150);
  };
  SB.reset = function () { state = defaultState(); try { window.localStorage.removeItem(KEY); } catch (e) { } SB.save(); SB.emit('reset'); };
  SB.state = function () { return state; };
  SB.exportJSON = function () { return JSON.stringify(state, null, 2); };

  /* ---------- accounts ---------- */
  SB.acct = function (id) { return state.accounts.find(function (a) { return a.id === (id || state.activeAcct); }) || state.accounts[0]; };
  SB.acctsFor = function (id) { return id === 'all' ? state.accounts : [SB.acct(id)]; };
  SB.posValue = function (a) { return Object.keys(a.positions).reduce(function (t, k) { return t + a.positions[k].qty * SB.unit(SB.bySym[k]); }, 0); };
  SB.acctValue = function (a) { return a.cash + SB.posValue(a); };
  SB.sumValue = function (list) { return list.reduce(function (t, a) { return t + SB.acctValue(a); }, 0); };
  SB.dayChange = function (list) {
    return list.reduce(function (t, a) { return t + Object.keys(a.positions).reduce(function (u, k) { const s = SB.bySym[k]; return u + a.positions[k].qty * (SB.unit(s) - SB.unitAt(s, s.prev)); }, 0); }, 0);
  };
  SB.costBasis = function (list) { return list.reduce(function (t, a) { return t + Object.keys(a.positions).reduce(function (u, k) { return u + a.positions[k].cost; }, 0); }, 0); };
  SB.orderRef = function (o) { const s = SB.bySym[o.sym]; return o.type === 'limit' || o.type === 'stoplimit' ? o.limit : o.type === 'stop' ? o.stop : s.price; };
  SB.openOrders = function (accId) { return state.orders.filter(function (o) { return o.status === 'open' && (!accId || accId === 'all' || o.acct === accId); }); };
  SB.reserved = function (a) {
    return state.orders.reduce(function (t, o) { return o.status === 'open' && o.acct === a.id && o.side === 'buy' ? t + o.qty * SB.unitAt(SB.bySym[o.sym], SB.orderRef(o)) : t; }, 0);
  };
  SB.availableCash = function (a) { return r2(a.cash - SB.reserved(a)); };
  SB.availableQty = function (a, sym) {
    const p = a.positions[sym]; if (!p) return 0;
    const held = state.orders.reduce(function (t, o) { return o.status === 'open' && o.acct === a.id && o.sym === sym && o.side === 'sell' ? t + o.qty : t; }, 0);
    return r4(p.qty - held);
  };
  SB.allocation = function (list) {
    const m = { Stocks: 0, ETFs: 0, 'Mutual funds': 0, Bonds: 0, Cash: 0 };
    list.forEach(function (a) {
      m.Cash += a.cash;
      Object.keys(a.positions).forEach(function (k) {
        const s = SB.bySym[k], v = a.positions[k].qty * SB.unit(s);
        m[s.type === 'stock' ? 'Stocks' : s.type === 'etf' ? 'ETFs' : s.type === 'fund' ? 'Mutual funds' : 'Bonds'] += v;
      });
    });
    return Object.keys(m).map(function (k) { return { label: k, value: m[k] }; }).filter(function (x) { return x.value > 0.005; });
  };
  SB.series = function (list, n) {
    const out = [], L = SB.dates.length;
    for (let i = L - n; i < L; i++) {
      let t = 0;
      list.forEach(function (a) { t += a.cash; Object.keys(a.positions).forEach(function (k) { const s = SB.bySym[k]; t += a.positions[k].qty * SB.unitAt(s, s.hist[i]); }); });
      out.push(t);
    }
    return out;
  };
  SB.openAccount = function (type, opts) {
    opts = opts || {};
    if (state.accounts.length >= 8) return { ok: false, msg: 'The simulator supports up to 8 accounts.' };
    const a = newAcct(type, opts.name);
    if (type === 'custodial') { a.child = { name: opts.child || 'Child', born: opts.born || new Date().getFullYear() - 5 }; if (!opts.name) a.name = 'Custodial account for ' + a.child.name; }
    if (type === 'roth' || type === 'trad') a.contribYear = new Date().getFullYear();
    state.accounts.push(a); SB.save(); SB.emit('accounts');
    return { ok: true, acct: a, msg: a.name + ' opened (' + a.num + ').' };
  };

  /* ---------- orders ---------- */
  function bad(msg) { return { ok: false, msg: msg }; }
  SB.validateOrder = function (o) {
    const a = SB.acct(o.acct), s = SB.bySym[String(o.sym || '').trim().toUpperCase()];
    if (!a) return bad('Choose an account.');
    if (!s) return bad('Enter a valid symbol, such as AAPL or FXAIX.');
    const type = o.type || 'market', side = o.side === 'sell' ? 'sell' : 'buy';
    if (s.type === 'bond' && type !== 'market' && type !== 'limit') return bad('Bonds support market and limit orders.');
    if (s.type === 'fund' && type !== 'market') return bad('Mutual funds price once a day at the NAV, so only market orders are available.');
    const lim = +o.limit, stp = +o.stop;
    if ((type === 'limit' || type === 'stoplimit') && !(lim > 0)) return bad('Enter a limit price greater than zero.');
    if ((type === 'stop' || type === 'stoplimit') && !(stp > 0)) return bad('Enter a stop price greater than zero.');
    if (type === 'stop' || type === 'stoplimit') {
      if (side === 'sell' && stp >= s.price) return bad('A sell stop must be set below the current price (' + s.price.toFixed(2) + ').');
      if (side === 'buy' && stp <= s.price) return bad('A buy stop must be set above the current price (' + s.price.toFixed(2) + ').');
    }
    let qty = +o.qty || 0;
    if (o.mode === 'dollars') {
      if (s.type === 'bond') return bad('Bonds are bought in whole units of $1,000 face value.');
      if (type !== 'market') return bad('Dollar-based orders are available for market orders only.');
      const d = +o.dollars; if (!(d > 0)) return bad('Enter a dollar amount greater than zero.');
      qty = Math.floor(d / s.price * 10000) / 10000;
      if (!(qty > 0)) return bad('That amount is too small to buy any shares.');
    } else {
      if (!(qty > 0)) return bad('Enter a quantity greater than zero.');
      if (s.type === 'bond' && !Number.isInteger(qty)) return bad('Bonds trade in whole units of $1,000 face value.');
      if (type !== 'market' && !Number.isInteger(qty)) return bad('Limit and stop orders need a whole number of shares.');
      qty = r4(qty);
    }
    if (qty > 1e7) return bad('That quantity is larger than the simulator allows.');
    const ref = type === 'limit' || type === 'stoplimit' ? lim : type === 'stop' ? stp : s.price;
    const est = qty * SB.unitAt(s, ref);
    if (side === 'buy' && est > SB.availableCash(a) + 1e-6) return bad('Not enough available cash. You need ' + SB.money(est) + ' but have ' + SB.money(SB.availableCash(a)) + '. Transfer money in, or reduce the order.');
    if (side === 'sell') { const av = SB.availableQty(a, s.sym); if (qty > av + 1e-6) return bad('You can sell up to ' + av + ' of ' + s.sym + ' in this account (open sell orders are reserved).'); }
    return { ok: true, a: a, s: s, qty: qty, est: est, type: type, side: side, limit: lim || null, stop: stp || null };
  };
  SB.describeOrder = function (o) {
    const s = SB.bySym[o.sym], u = s.type === 'bond' ? 'bond' + (o.qty === 1 ? '' : 's') : (o.qty === 1 ? 'share' : 'shares');
    const t = { market: 'Market', limit: 'Limit ' + (o.limit != null ? o.limit.toFixed(2) : ''), stop: 'Stop ' + (o.stop != null ? o.stop.toFixed(2) : ''), stoplimit: 'Stop ' + (o.stop != null ? o.stop.toFixed(2) : '') + ' / limit ' + (o.limit != null ? o.limit.toFixed(2) : '') }[o.type];
    return (o.side === 'buy' ? 'Buy ' : 'Sell ') + o.qty + ' ' + u + ' of ' + o.sym + ' — ' + t;
  };
  SB.placeOrder = function (o) {
    const v = SB.validateOrder(o); if (!v.ok) return v;
    const order = { id: uid('o'), acct: v.a.id, sym: v.s.sym, side: v.side, type: v.type, qty: v.qty, limit: v.limit, stop: v.stop, status: 'open', created: Date.now(), triggered: false };
    state.orders.unshift(order);
    SB.checkOrders();
    SB.save(); SB.emit('orders', [order]);
    if (order.status === 'filled') return { ok: true, order: order, msg: 'Filled: ' + SB.describeOrder(order) + ' at ' + SB.priceStr(SB.bySym[order.sym], order.fillPrice) + '.' };
    const wait = SB.feed && !SB.feed.canFill(v.s) ? ' The market is closed or the price feed is paused, so it will be filled at the real price once trading resumes.' : '';
    return { ok: true, order: order, msg: 'Order accepted and working: ' + SB.describeOrder(order) + '.' + wait };
  };
  SB.priceStr = function (s, p) { return s.type === 'bond' ? p.toFixed(3) + ' per $100' : SB.money(p); };
  function fill(o, price) {
    const a = SB.acct(o.acct), s = SB.bySym[o.sym], val = r2(o.qty * SB.unitAt(s, price));
    if (o.side === 'buy') {
      if (val > a.cash + 0.005) { o.status = 'rejected'; o.reason = 'Insufficient cash at execution.'; return false; }
      a.cash = r2(a.cash - val);
      const p = a.positions[o.sym] || (a.positions[o.sym] = { qty: 0, cost: 0 });
      p.qty = r4(p.qty + o.qty); p.cost += val;
    } else {
      const p = a.positions[o.sym];
      if (!p || p.qty < o.qty - 1e-6) { o.status = 'rejected'; o.reason = 'Shares not available at execution.'; return false; }
      const costPart = p.cost * Math.min(1, o.qty / p.qty);
      o.realized = r2(val - costPart);
      p.qty = r4(p.qty - o.qty); p.cost -= costPart;
      if (p.qty <= 0.00005) delete a.positions[o.sym];
      a.cash = r2(a.cash + val);
    }
    o.status = 'filled'; o.fillPrice = price; o.filled = Date.now(); o.total = val;
    state.txns.unshift({ id: uid('t'), ts: o.filled, acct: a.id, kind: o.side === 'buy' ? 'Bought' : 'Sold', sym: o.sym, qty: o.qty, price: price, amount: o.side === 'buy' ? -val : val, desc: (o.side === 'buy' ? 'Bought ' : 'Sold ') + o.qty + ' ' + o.sym, orderId: o.id });
    return true;
  }
  SB.checkOrders = function () {
    const done = [];
    state.orders.forEach(function (o) {
      if (o.status !== 'open') return;
      const s = SB.bySym[o.sym], px = s.price; let go = false;
      if (SB.feed && !SB.feed.canFill(s)) return;     // real mode: wait for an open market and a fresh price
      if (o.type === 'market') go = true;
      else if (o.type === 'limit') go = o.side === 'buy' ? px <= o.limit : px >= o.limit;
      else if (o.type === 'stop') go = o.side === 'buy' ? px >= o.stop : px <= o.stop;
      else if (o.type === 'stoplimit') {
        if (!o.triggered && (o.side === 'buy' ? px >= o.stop : px <= o.stop)) o.triggered = true;
        if (o.triggered) go = o.side === 'buy' ? px <= o.limit : px >= o.limit;
      }
      if (go) { fill(o, px); done.push(o); }
    });
    if (done.length) { SB.save(); SB.emit('filled', done); }
    return done;
  };
  SB.cancelOrder = function (id) {
    const o = state.orders.find(function (x) { return x.id === id; });
    if (!o || o.status !== 'open') return { ok: false, msg: 'That order is no longer open.' };
    o.status = 'cancelled'; SB.save(); SB.emit('orders', [o]);
    return { ok: true, msg: 'Cancelled: ' + SB.describeOrder(o) + '.' };
  };

  /* ---------- money movement ---------- */
  SB.transfer = function (p) {
    const amount = r2(+p.amount);
    if (!(amount > 0)) return bad('Enter an amount greater than zero.');
    if (p.from === p.to) return bad('Choose two different places to move money between.');
    const A = p.from === 'bank' ? null : SB.acct(p.from), B = p.to === 'bank' ? null : SB.acct(p.to);
    if (A && amount > SB.availableCash(A) + 1e-6) return bad('Available cash in ' + A.name + ' is ' + SB.money(SB.availableCash(A)) + '.');
    if (B && SB.isIRA(B)) {
      const yr = new Date().getFullYear(); if (B.contribYear !== yr) { B.contribYear = yr; B.contrib = 0; }
      if (B.contrib + amount > SB.IRA_LIMIT) return bad('That would exceed the simulated annual IRA contribution limit of ' + SB.money(SB.IRA_LIMIT, 0) + ' (' + SB.money(SB.IRA_LIMIT - B.contrib) + ' remaining). Check irs.gov for real limits.');
      B.contrib = r2(B.contrib + amount);
    }
    const now = Date.now();
    if (A) { A.cash = r2(A.cash - amount); state.txns.unshift({ id: uid('t'), ts: now, acct: A.id, kind: B ? 'Transfer out' : 'Withdrawal', amount: -amount, desc: B ? 'Transfer to ' + B.name : 'Withdrawal to linked checking (simulated)' }); }
    if (B) { B.cash = r2(B.cash + amount); state.txns.unshift({ id: uid('t'), ts: now, acct: B.id, kind: A ? 'Transfer in' : 'Deposit', amount: amount, desc: A ? 'Transfer from ' + A.name : 'Deposit from linked checking (simulated)' }); }
    SB.save(); SB.emit('cash');
    return { ok: true, msg: SB.money(amount) + ' moved ' + (A ? 'from ' + A.name : 'from your linked checking account') + ' ' + (B ? 'to ' + B.name : 'to your linked checking account') + '.' };
  };
  SB.payBillNow = function (b) {
    const a = SB.acct(b.acct);
    if (b.amount > SB.availableCash(a) + 1e-6) { b.status = 'failed'; b.reason = 'Insufficient available cash'; return false; }
    a.cash = r2(a.cash - b.amount); b.status = 'paid'; b.paid = Date.now();
    state.txns.unshift({ id: uid('t'), ts: b.paid, acct: a.id, kind: 'Bill payment', amount: -b.amount, desc: 'Bill payment to ' + b.payee + (b.memo ? ' (' + b.memo + ')' : '') });
    return true;
  };
  SB.todayStr = function () { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  SB.payBill = function (p) {
    const amount = r2(+p.amount);
    if (!(amount > 0)) return bad('Enter an amount greater than zero.');
    if (!p.payee) return bad('Choose a payee.');
    if (!p.date) return bad('Choose a payment date.');
    if (p.date < SB.todayStr()) return bad('Payment date cannot be in the past.');
    const b = { id: uid('b'), acct: p.acct, payee: p.payee, amount: amount, date: p.date, memo: p.memo || '', status: 'scheduled', created: Date.now() };
    state.bills.unshift(b);
    if (p.date <= SB.todayStr()) { const ok = SB.payBillNow(b); SB.save(); SB.emit('cash'); return ok ? { ok: true, msg: 'Paid ' + SB.money(amount) + ' to ' + b.payee + '.' } : bad('Payment failed: not enough available cash.'); }
    SB.save(); return { ok: true, msg: 'Scheduled ' + SB.money(amount) + ' to ' + b.payee + ' for ' + p.date + '. Keep enough cash in the account by then.' };
  };
  SB.processBills = function () {
    const today = SB.todayStr(); let n = 0;
    state.bills.forEach(function (b) { if (b.status === 'scheduled' && b.date <= today) { SB.payBillNow(b); n++; } });
    if (n) SB.save();
    return n;
  };
  SB.payDividends = function (accId) {
    const a = SB.acct(accId); let total = 0, reinvested = 0; const now = Date.now();
    Object.keys(a.positions).forEach(function (k) {
      const s = SB.bySym[k], p = a.positions[k]; let amt = 0, kind = 'Dividend';
      if (s.type === 'bond') { if (s.coupon > 0) { amt = p.qty * 1000 * s.coupon / 100 / 2; kind = 'Interest'; } }
      else if (s.div > 0) amt = p.qty * s.price * s.div / 100 / 4;
      amt = r2(amt); if (amt <= 0) return;
      total += amt;
      if (a.features.drip && s.type !== 'bond') {
        const q = r4(amt / s.price); p.qty = r4(p.qty + q); p.cost += amt; reinvested += amt;
        state.txns.unshift({ id: uid('t'), ts: now, acct: a.id, kind: 'Dividend reinvested', sym: k, qty: q, price: s.price, amount: 0, desc: 'Dividend of ' + SB.money(amt) + ' reinvested in ' + k });
      } else {
        a.cash = r2(a.cash + amt);
        state.txns.unshift({ id: uid('t'), ts: now, acct: a.id, kind: kind, sym: k, amount: amt, desc: kind + ' paid on ' + k });
      }
    });
    SB.save(); SB.emit('cash');
    return total > 0 ? { ok: true, msg: 'Simulated payout of ' + SB.money(total) + ' (' + SB.money(reinvested) + ' reinvested, ' + SB.money(total - reinvested) + ' paid as cash).' } : bad('This account holds nothing that pays dividends or interest yet.');
  };
  SB.distribute = function (p) {
    const a = SB.acct(p.acct), amt = r2(+p.amount), pct = Math.max(0, Math.min(50, +p.withhold || 0));
    if (!(amt > 0)) return bad('Enter an amount greater than zero.');
    if (amt > SB.availableCash(a) + 1e-6) return bad('Available cash is ' + SB.money(SB.availableCash(a)) + '. Sell investments first (Trade) or lower the amount.');
    const wh = r2(amt * pct / 100), now = Date.now();
    a.cash = r2(a.cash - amt);
    state.txns.unshift({ id: uid('t'), ts: now, acct: a.id, kind: 'Distribution', amount: -(amt - wh), desc: 'IRA distribution to linked checking (simulated)' });
    if (wh > 0) state.txns.unshift({ id: uid('t'), ts: now, acct: a.id, kind: 'Tax withholding', amount: -wh, desc: 'Federal tax withholding (' + pct + '%)' });
    SB.save(); SB.emit('cash');
    return { ok: true, msg: 'Distribution of ' + SB.money(amt) + ' requested: ' + SB.money(amt - wh) + ' to your checking account and ' + SB.money(wh) + ' withheld.' };
  };
  SB.ytdDistributions = function (accId) {
    const y = new Date().getFullYear();
    return state.txns.filter(function (t) { return t.acct === accId && (t.kind === 'Distribution' || t.kind === 'Tax withholding') && new Date(t.ts).getFullYear() === y; }).reduce(function (s, t) { return s - t.amount; }, 0);
  };

  /* ---------- market simulation ---------- */
  SB.tickCount = 0;
  SB.tick = function () {
    SB.tickCount++;
    const real = SB.dataMode === 'real';
    SB.securities.forEach(function (s) {
      if (real && s.src === 'real') return;           // real prices come from the feed, not a random walk
      const scale = s.type === 'fund' ? 0.25 : 1;
      const sd = s.vol / Math.sqrt(252) / 10 * scale;
      const pull = 0.01 * (s.anchor - s.price) / s.price;
      let p = s.price * Math.exp(sd * SB.gauss(Math.random) + pull);
      const lo = s.prev * (s.type === 'bond' ? 0.97 : 0.92), hi = s.prev * (s.type === 'bond' ? 1.03 : 1.08);
      p = Math.min(hi, Math.max(lo, p));
      s.price = Math.round(p * (s.type === 'bond' ? 1000 : 100)) / (s.type === 'bond' ? 1000 : 100);
      s.hist[s.hist.length - 1] = s.price;
      s.intra.push(s.price); if (s.intra.length > 240) s.intra.shift();
    });
    if (real && SB.tickCount % 20 === 0) SB.feed.refresh();       // about once a minute
    if (real && SB.tickCount % 100 === 0) SB.feed.loadNews();     // about every 5 minutes
    SB.checkOrders();
    let story = null;
    if (!real && SB.tickCount % 25 === 0) { story = SB.newsMaybe(); if (story) SB.emit('news', story); }
    if (SB.tickCount % 20 === 0) SB.processBills();
    SB.emit('tick');
  };
})();
