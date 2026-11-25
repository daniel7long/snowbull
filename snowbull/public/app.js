/* SnowBull standalone glue: mounts the chat and turns the optional holdings box into portfolio context. */
(function () {
  'use strict';
  const cfg = window.SNOWBULL_CONFIG || {};
  const FUNDS = { SPY: 'etf', QQQ: 'etf', VTI: 'etf', VXUS: 'etf', VOO: 'etf', IVV: 'etf', SCHD: 'etf', VNQ: 'etf', GLD: 'etf', IWM: 'etf', DIA: 'etf', ARKK: 'etf', TQQQ: 'etf', SQQQ: 'etf', BND: 'etf', AGG: 'etf', FXAIX: 'fund', FZROX: 'fund', FSKAX: 'fund', VTSAX: 'fund', VFIAX: 'fund', FXNAX: 'fund', FBALX: 'fund' };
  const holdings = document.getElementById('holdings'), msg = document.getElementById('hold-msg');
  let portfolio = null;

  function parse() {
    const pos = []; let cash = 0, bad = 0;
    String(holdings.value || '').split('\n').forEach(function (line) {
      line = line.trim(); if (!line) return;
      const m = line.match(/^\$?([A-Za-z]{1,6})\s*[: ,]?\s*\$?([\d,]+(?:\.\d+)?)$/);
      if (!m) { bad++; return; }
      const sym = m[1].toUpperCase(), v = parseFloat(m[2].replace(/,/g, ''));
      if (!(v >= 0)) { bad++; return; }
      if (sym === 'CASH') cash += v; else pos.push({ sym: sym, name: sym, type: FUNDS[sym] || 'stock', value: v });
    });
    const total = cash + pos.reduce(function (a, p) { return a + p.value; }, 0);
    portfolio = total > 0 ? { total: total, cash: cash, positions: pos } : null;
    msg.textContent = portfolio ? 'Using ' + pos.length + ' holding' + (pos.length === 1 ? '' : 's') + ' worth $' + Math.round(total).toLocaleString('en-US') + '.' + (bad ? ' ' + bad + ' line(s) ignored.' : '') : (bad ? 'Could not read those lines. Use "AAPL 5000".' : '');
  }
  holdings.addEventListener('input', parse);

  if (cfg.snowballUrl) { const a = document.getElementById('to-snowball'); a.href = cfg.snowballUrl; a.hidden = false; }
  window.SnowBullUI.mount(document.getElementById('chat'), {
    endpoint: cfg.endpoint, heading: 'SnowBull', headingTag: 'h2', storageKey: 'snowbull.standalone.v1',
    getContext: function () { return { route: 'standalone', portfolio: portfolio, symbols: portfolio ? portfolio.positions.map(function (p) { return { sym: p.sym, name: p.name, type: p.type, price: 0, prev: 0 }; }) : [] }; }
  });
})();
