/* SnowBall+ — app shell: navigation, hash router, events, live updates. */
(function () {
  'use strict';
  const SB = window.SB, esc = SB.esc;
  const $ = function (id) { return document.getElementById(id); };

  // Navigation mirrors the reference screenshots. Items that were struck out
  // (Fidelity Trader+ Web, Fidelity Trader+, Tax Forms & Information) are intentionally omitted.
  const NAV = [
    { id: 'accounts', label: 'Accounts & Trade', items: [['portfolio', 'Portfolio'], ['positions', 'Account Positions'], ['trade', 'Trade'], ['transfers', 'Transfers'], ['cash', 'Cash Management'], ['billpay', 'Bill Pay'], ['fullview', 'Full View'], ['security', 'Security Settings'], ['features', 'Account Features'], ['documents', 'Documents'], ['distributions', 'Retirement Distributions'], ['refer', 'Refer a Friend']] },
    { id: 'investing', label: 'Investing', items: [['self-directed', 'Self-Directed Investing'], ['advanced-trading', 'Advanced Trading'], ['investing-child', 'Investing for a Child'], ['cash-credit', 'Managing Cash & Credit'], ['products', 'Investment Accounts & Products'], ['education', 'Investing & Trading Education']] },
    { id: 'retirement', label: 'Retirement', items: [['retirement-planning', 'Retirement Planning'], ['retirement-accounts', 'Retirement Accounts'], ['retirement-education', 'Retirement Education']] },
    { id: 'wealth', label: 'Wealth Management', items: [['wealth-offerings', 'Wealth Management Offerings'], ['advisors', 'Financial Advisors'], ['financial-planning', 'Financial Planning'], ['investment-management', 'Investment Management'], ['wealth-insights', 'Wealth Management Insights']] },
    { id: 'news', label: 'News & Research', link: 'news' },
    { id: 'snowbull', label: 'SnowBull AI', link: 'snowbull' }
  ];

  SB.route = 'home';
  function cleanRoute(h) { h = String(h || '').replace(/^#\/?/, ''); return /^[A-Za-z0-9.-]+$/.test(h) ? h : 'home'; }
  function resolve(r) {
    if (SB.pages[r] && r !== 'quote' && r !== 'story') return [r, null];
    if (r.indexOf('quote-') === 0) return ['quote', r.slice(6)];
    if (r.indexOf('news-') === 0) return ['story', r.slice(5)];
    return ['notfound', null];
  }

  /* ---------- rendering ---------- */
  function render(keep) {
    const main = $('main-content'), pr = resolve(SB.route), name = pr[0], arg = pr[1];
    const active = document.activeElement, activeId = active && active.id, sy = window.scrollY;
    if (!keep) SB.ui.result = null;
    let html;
    try { html = SB.pages[name](arg); }
    catch (e) { console.error(e); html = SB.page('Something went wrong', '', SB.notice('This page could not be displayed (' + esc(e.message) + ').', 'err')); }
    main.innerHTML = html;
    Array.prototype.forEach.call(document.querySelectorAll('[data-init]'), function (el) { const fn = SB.inits[el.dataset.init]; if (fn) { try { fn(el); } catch (e) { console.error(e); } } });
    const h = $('page-title'); document.title = (h ? h.textContent : 'SnowBall+') + ' — SnowBall+';
    markNav();
    if (keep) { if (activeId) { const e = $(activeId); if (e && e.focus) e.focus({ preventScroll: true }); } window.scrollTo(0, sy); }
    else { window.scrollTo(0, 0); if (h) h.focus({ preventScroll: true }); }
  }
  SB.rerender = function () { render(true); };
  SB.go = function (r) {
    r = cleanRoute(r); SB.route = r; closeMenus(); closeMobile(); render(false);
    try { if (location.hash !== '#' + r) location.hash = r; } catch (e) { /* hash not writable in this context */ }
  };
  window.addEventListener('hashchange', function () {
    const r = cleanRoute(location.hash); if (location.hash && r !== SB.route) { SB.route = r; render(false); }
  });

  SB.updateLive = function (force) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-live]'), function (el) {
      const fn = SB.frag[el.dataset.live]; if (!fn) return;
      if (!force && el.contains(document.activeElement)) return;
      try { el.innerHTML = fn(el.dataset.arg || ''); } catch (e) { console.error(e); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('form[data-init="ticket"]'), function (f) { if (!f.contains(document.activeElement) || document.activeElement.tagName !== 'SELECT') SB.inits.ticket(f); });
  };

  /* ---------- navigation ---------- */
  function buildNav() {
    $('nav-list').innerHTML = NAV.map(function (g) {
      if (g.link) return '<li class="nav-item"><a class="nav-link" href="#' + g.link + '" data-nav="' + g.id + '">' + g.label + '</a></li>';
      return '<li class="nav-item"><button type="button" class="nav-btn" aria-expanded="false" aria-controls="menu-' + g.id + '" data-act="nav-menu" data-id="' + g.id + '">' + g.label + ' <span aria-hidden="true" class="caret">▾</span></button><ul class="menu" id="menu-' + g.id + '" hidden>' +
        g.items.map(function (i) { return '<li><a href="#' + i[0] + '" data-route="' + i[0] + '">' + i[1] + '</a></li>'; }).join('') + '</ul></li>';
    }).join('');
  }
  function closeMenus(focusBtn) {
    Array.prototype.forEach.call(document.querySelectorAll('.nav-btn[aria-expanded="true"]'), function (b) {
      b.setAttribute('aria-expanded', 'false'); const m = $(b.getAttribute('aria-controls')); if (m) m.hidden = true; if (focusBtn) b.focus();
    });
  }
  function closeMobile() { const l = $('nav-list'), t = $('nav-toggle'); if (l) l.classList.remove('open'); if (t) t.setAttribute('aria-expanded', 'false'); }
  function markNav() {
    const r = SB.route;
    Array.prototype.forEach.call(document.querySelectorAll('#nav-list a'), function (a) {
      const on = a.dataset.route === r || a.dataset.nav === r || (a.dataset.nav === 'news' && (r === 'news' || r.indexOf('news-') === 0));
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (b) { const m = $(b.getAttribute('aria-controls')); b.classList.toggle('current', !!(m && m.querySelector('[aria-current="page"]'))); });
  }
  SB.acts['nav-menu'] = function (b) {
    const open = b.getAttribute('aria-expanded') === 'true'; closeMenus();
    if (!open) { b.setAttribute('aria-expanded', 'true'); $(b.getAttribute('aria-controls')).hidden = false; }
  };
  SB.acts['nav-toggle'] = function (b) { const l = $('nav-list'), o = l.classList.toggle('open'); b.setAttribute('aria-expanded', String(o)); };
  SB.acts['dlg-close'] = function () { SB.closeDialog(); };
  SB.acts['toast-close'] = function (b) { const t = b.closest('.toast'); if (t) t.remove(); };

  /* ---------- preferences & header controls ---------- */
  SB.applyPrefs = function () {
    const p = SB.state().prefs;
    document.documentElement.style.fontSize = Math.round(p.fs * 100) + '%';
    document.body.classList.toggle('hc', !!p.hc);
    const t = $('live-toggle'); if (t) { t.setAttribute('aria-pressed', String(!!p.live)); t.textContent = p.live ? 'Live prices: on' : 'Live prices: paused'; }
  };
  SB.acts['live-toggle'] = function () { const p = SB.state().prefs; p.live = !p.live; SB.save(); SB.applyPrefs(); SB.toast(p.live ? 'Live prices are on.' : 'Live prices are paused. Prices and orders will not change until you turn them back on.', 'info'); if (SB.route === 'security') SB.rerender(); };
  SB.buildAcctSwitch = function () {
    const s = SB.state(), sel = $('acct-switch'); if (!sel) return;
    sel.innerHTML = SB.opts(s.accounts.map(function (a) { return [a.id, a.name]; }), s.activeAcct);
  };
  SB.forms['search'] = function (f) {
    const q = String(f.elements.q.value || '').trim(); if (!q) return;
    const up = q.toUpperCase();
    f.elements.q.value = '';
    if (SB.bySym[up]) { SB.go('quote-' + up); return; }
    SB.ui.q = q; SB.go('research');
  };

  /* ---------- global events ---------- */
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href^="#"]');
    if (a) {
      const id = a.getAttribute('href').slice(1);
      if (id === 'main-content') { e.preventDefault(); $('main-content').focus(); return; }
      e.preventDefault(); SB.go(id); return;
    }
    const b = e.target.closest('[data-act]');
    if (b) { const fn = SB.acts[b.dataset.act]; if (fn) { try { fn(b, e); } catch (err) { console.error(err); SB.toast('Something went wrong. Please try again.', 'err'); } } return; }
    if (!e.target.closest('#primary-nav')) closeMenus();
    const d = $('dlg'); if (e.target === d) SB.closeDialog();
  });
  document.addEventListener('submit', function (e) {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    const fn = SB.forms[f.dataset.form];
    if (fn) { try { fn(f); } catch (err) { console.error(err); SB.toast('Something went wrong. Please try again.', 'err'); } }
  });
  function onField(e, kind) {
    const t = e.target; if (!t || !t.closest) return;
    if (kind === 'change' && t.name && t.name.indexOf('sweep-') === 0) { SB.changes.sweep(t); return; }
    if (t.id === 'acct-switch') { const s = SB.state(); s.activeAcct = t.value; SB.save(); SB.rerender(); return; }
    const key = kind === 'input' ? t.dataset.input : t.dataset.change, table = kind === 'input' ? SB.inputs : SB.changes;
    if (key && table[key]) { table[key](t, e); return; }
    const f = t.closest('form[data-init]');
    if (f && SB.inits[f.dataset.init]) SB.inits[f.dataset.init](f);
  }
  document.addEventListener('input', function (e) { onField(e, 'input'); });
  document.addEventListener('change', function (e) { onField(e, 'change'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const open = document.querySelector('.nav-btn[aria-expanded="true"]');
      if (open) { closeMenus(true); e.preventDefault(); } else if ($('nav-list').classList.contains('open')) { closeMobile(); $('nav-toggle').focus(); }
    }
  });
  document.addEventListener('DOMContentLoaded', function () {
    $('primary-nav').addEventListener('focusout', function (e) { if (!$('primary-nav').contains(e.relatedTarget)) closeMenus(); });
    $('dlg').addEventListener('close', function () { const o = SB.ui.opener; if (o && document.contains(o) && o.focus) o.focus(); });
  });

  /* ---------- live events ---------- */
  SB.on('filled', function (list) {
    if (!SB.ui.inTick || !SB.state().prefs.alertOrders) return;
    list.forEach(function (o) { if (o.status === 'filled') SB.toast('Order filled: ' + SB.describeOrder(o) + ' at ' + SB.priceStr(SB.bySym[o.sym], o.fillPrice) + '.', 'ok'); else if (o.status === 'rejected') SB.toast('Order rejected: ' + SB.describeOrder(o) + '. ' + (o.reason || ''), 'err'); });
    if (['positions', 'portfolio', 'trade', 'advanced-trading', 'home'].indexOf(SB.route) > -1) SB.rerender();
  });
  SB.on('news', function (n) { const s = SB.state(); if (s.prefs.alertNews && n.sym && s.watch.indexOf(n.sym) > -1) SB.toast('News on your watchlist: ' + n.title, 'info'); });

  function start() {
    try { SB.load(); } catch (e) { console.error(e); }
    SB.seedNews(); buildNav(); buildSymList(); SB.buildAcctSwitch(); SB.applyPrefs();
    $('nav-toggle').setAttribute('data-act', 'nav-toggle');
    SB.route = cleanRoute(location.hash);
    render(false);
    SB.feed.paintBanner(); SB.feed.start();
    setInterval(function () {
      if (!SB.state().prefs.live || document.hidden) return;
      SB.ui.inTick = true; try { SB.tick(); } finally { SB.ui.inTick = false; }
      SB.updateLive();
    }, 3000);
  }
  function buildSymList() { $('symlist').innerHTML = SB.securities.map(function (s) { return '<option value="' + s.sym + '">' + esc(s.name) + '</option>'; }).join(''); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
