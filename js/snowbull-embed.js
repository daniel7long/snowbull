/* SnowBall+ — SnowBull AI embed. Adds (1) a "SnowBull AI" page in the main navigation and (2) a floating assistant
 * available on every other page. It passes SnowBall+ context (the securities and prices the app is showing, real
 * headlines only, and the active account's holdings) to the SnowBull API so answers are current and personal.
 * Without cfg.snowbullApi it runs the same RAG engine in the browser (js/snowbull-core.js), so it never goes dark.
 * Files js/snowbull-*.js and css/snowbull.css are copied from /snowbull by `npm run sync` — do not edit them here. */
(function () {
  'use strict';
  const SB = window.SB, UI = window.SnowBullUI;
  if (!SB || !UI) return;
  const cfg = window.SB_CONFIG || {};
  const endpoint = cfg.snowbullApi ? String(cfg.snowbullApi).replace(/\/+$/, '') + '/api/chat' : null;

  /* ---------- context from the running app ---------- */
  function context() {
    const ctx = { route: SB.route || '', symbols: [], news: [], portfolio: null };
    try {
      ctx.symbols = SB.securities.map(function (s) {
        return { sym: s.sym, name: s.name, type: s.type, price: +s.price, prev: +s.prev, src: s.src === 'real' ? 'real' : 'sim', asOf: s.qts || 0 };
      });
      // only genuine headlines: simulated stories must never be presented as news
      ctx.news = (SB.news || []).filter(function (n) { return n.real; }).slice(0, 20).map(function (n) { return { title: n.title, sym: n.sym || '', ts: n.ts, source: n.source || '' }; });
      const a = SB.acct();
      if (a) {
        const positions = Object.keys(a.positions || {}).map(function (k) {
          const s = SB.bySym[k], p = a.positions[k];
          return s && p.qty > 0 ? { sym: k, name: s.name, type: s.type, value: p.qty * SB.unit(s) } : null;
        }).filter(Boolean);
        ctx.portfolio = { total: SB.acctValue(a), cash: a.cash, positions: positions };
      }
    } catch (e) { console.error(e); }
    return ctx;
  }
  function starters() {
    const m = /^quote-([A-Z0-9.]+)$/.exec(SB.route || ''), list = [];
    if (m) list.push('Why is ' + m[1] + ' moving today?', 'What are the risks of ' + m[1] + '?', 'Is ' + m[1] + ' too big a share of my portfolio?');
    list.push('Review my portfolio for risk', 'How do I spot an investment scam?', 'How should I start investing?');
    return list.slice(0, 4);
  }
  const opts = function (extra) { return Object.assign({ endpoint: endpoint, getContext: context, starters: starters }, extra); };

  /* ---------- full page ---------- */
  SB.pages.snowbull = function () {
    return SB.page('SnowBull AI', 'Ask questions in plain words. SnowBull answers from a vetted investing library and live market data, cites its sources, and warns you about scams and risky trades.',
      '<div class="grid g2-1"><div data-init="snowbull" id="snowbull-page"></div><div class="stack">' +
      '<section class="card" aria-labelledby="sbp1"><h2 id="sbp1">What SnowBull checks</h2><ul class="plain">' +
      '<li><strong>Sources:</strong> every answer cites SEC, FINRA, IRS or FTC guidance, or live data.</li>' +
      '<li><strong>Current data:</strong> prices and headlines come from the SnowBall+ data feed and the SnowBull service.</li>' +
      '<li><strong>Your portfolio:</strong> it sees your active practice account to flag concentration.</li>' +
      '<li><strong>Scams &amp; risk:</strong> every message is scanned for fraud patterns and risky trading.</li></ul></section>' +
      '<section class="card" aria-labelledby="sbp2"><h2 id="sbp2">Good to know</h2>' + SB.notice('SnowBall+ money and orders are fictional. SnowBull gives educational information, not personalised investment advice. Never share passwords, codes or card numbers.', 'info') +
      '<p class="muted small">' + (endpoint ? 'Connected to the SnowBull service.' : 'Running in offline mode: answers use the built-in library and the prices shown in SnowBall+.') + '</p></section></div></div>');
  };
  SB.inits.snowbull = function (el) { if (!el.dataset.mounted) { el.dataset.mounted = '1'; UI.mount(el, opts({ heading: 'SnowBull', headingTag: 'h2', storageKey: 'snowbull.page.v1' })); } };

  /* ---------- floating assistant ---------- */
  let dock = null, launch = null, dockUI = null;
  function build() {
    launch = document.createElement('button'); launch.type = 'button'; launch.className = 'sbl-launch';
    launch.setAttribute('aria-expanded', 'false'); launch.setAttribute('aria-controls', 'sbl-dock');
    launch.innerHTML = '<span class="sbl-mark" aria-hidden="true"><svg viewBox="0 0 32 32" width="24" height="24" focusable="false"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#0B2A3C" stroke-width="2"/><path d="M16 7v18M7 16h18M9.6 9.6l12.8 12.8M22.4 9.6L9.6 22.4" stroke="#0B2A3C" stroke-width="2" stroke-linecap="round"/></svg></span><span class="sbl-label">Ask SnowBull</span>';
    dock = document.createElement('div'); dock.id = 'sbl-dock'; dock.className = 'sbl-dock'; dock.hidden = true; dock.setAttribute('role', 'region'); dock.setAttribute('aria-label', 'SnowBull assistant');
    document.body.appendChild(dock); document.body.appendChild(launch);
    launch.addEventListener('click', function () { toggle(dock.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !dock.hidden) { toggle(false); launch.focus(); } });
  }
  function toggle(open) {
    if (open && !dockUI) dockUI = UI.mount(dock, opts({ heading: 'SnowBull', headingTag: 'h2', closeButton: true, storageKey: 'snowbull.dock.v1', onClose: function () { toggle(false); launch.focus(); } }));
    dock.hidden = !open; launch.setAttribute('aria-expanded', String(open));
    if (open && dockUI) dockUI.focus();
  }
  function sync() { const onPage = SB.route === 'snowbull'; if (launch) launch.hidden = onPage; if (onPage && dock && !dock.hidden) toggle(false); }
  function start() {
    build(); sync();
    const go = SB.go; SB.go = function (r) { go.apply(this, arguments); sync(); };
    window.addEventListener('hashchange', function () { setTimeout(sync, 0); });
    // other pages can open the assistant with a prefilled question: SB.snowbull.ask('...')
    SB.snowbull = { ask: function (q) { toggle(true); if (dockUI) dockUI.ask(q); }, open: function () { toggle(true); } };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
