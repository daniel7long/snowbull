/* SnowBall+ — shared UI helpers: formatting, charts, forms, dialogs. */
(function () {
  'use strict';
  const SB = window.SB;
  const nf = function (n, d) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  SB.nf = nf;
  SB.money = function (n, d) { d = d == null ? 2 : d; n = +n || 0; const neg = n < 0 && Math.round(Math.abs(n) * Math.pow(10, d)) > 0; return (neg ? '-' : '') + '$' + nf(Math.abs(n), d); };
  SB.pct = function (n, d) { return nf(n, d == null ? 2 : d) + '%'; };
  SB.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const esc = SB.esc;
  SB.qty = function (q) { return nf(q, Number.isInteger(q) ? 0 : 4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''); };

  /* Change indicator: arrow + words for screen readers so colour is never the only cue. */
  SB.chg = function (amt, pct, o) {
    o = o || {};
    const z = Math.abs(amt) < 0.005 && Math.abs(pct || 0) < 0.005;
    const cls = z ? 'flat' : amt > 0 ? 'up' : 'down';
    const arrow = z ? '–' : amt > 0 ? '▲' : '▼', word = z ? 'Unchanged ' : amt > 0 ? 'Up ' : 'Down ';
    const m = o.noMoney ? '' : (o.fmt ? o.fmt(Math.abs(amt)) : SB.money(Math.abs(amt))) + ' ';
    const p = pct == null ? '' : '(' + nf(Math.abs(pct), 2) + '%)';
    return '<span class="chg ' + cls + '"><span aria-hidden="true">' + arrow + '</span> <span class="sr">' + word + '</span>' + m + p + '</span>';
  };
  SB.dayOf = function (s) { return { amt: s.price - s.prev, pct: (s.price / s.prev - 1) * 100 }; };
  SB.quoteChg = function (s) { const d = SB.dayOf(s); return SB.chg(d.amt, d.pct, { fmt: s.type === 'bond' ? function (v) { return nf(v, 3); } : null }); };
  SB.pxText = function (s) { return s.type === 'bond' ? nf(s.price, 3) : SB.money(s.price); };
  SB.timeAgo = function (ts) {
    const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' hr ago';
    return Math.round(h / 24) + ' days ago';
  };
  SB.dateStr = function (ts) { return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  SB.dateTime = function (ts) { return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };

  /* ---------- layout helpers ---------- */
  SB.page = function (title, lead, body) {
    return '<div class="container"><header class="page-head"><h1 id="page-title" tabindex="-1">' + esc(title) + '</h1>' + (lead ? '<p class="lead">' + lead + '</p>' : '') + '</header>' + body + '</div>';
  };
  SB.live = function (name, arg) { return '<div class="live" data-live="' + name + '" data-arg="' + esc(arg == null ? '' : arg) + '">' + SB.frag[name](arg == null ? '' : String(arg)) + '</div>'; };
  SB.tile = function (label, value, sub) { return '<div class="tile"><p class="tile-label">' + label + '</p><p class="tile-value">' + value + '</p>' + (sub ? '<p class="tile-sub">' + sub + '</p>' : '') + '</div>'; };
  SB.badge = function (t, cls) { return '<span class="badge ' + (cls || '') + '">' + esc(t) + '</span>'; };
  SB.opts = function (list, val) {
    return list.map(function (x) { const v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
  };
  SB.acctOptions = function (o) {
    o = o || {}; const l = [];
    if (o.all) l.push(['all', 'All accounts']);
    if (o.bank) l.push(['bank', 'Linked checking (simulated)']);
    SB.state().accounts.forEach(function (a) { if (!o.only || o.only(a)) l.push([a.id, a.name + ' · ' + a.num]); });
    return l;
  };
  SB.field = function (o) {
    const id = o.id, dd = o.hint ? ' aria-describedby="' + id + '-h"' : '';
    let ctl;
    if (o.options) ctl = '<select class="input" id="' + id + '" name="' + (o.name || id) + '"' + dd + (o.attrs || '') + '>' + SB.opts(o.options, o.value) + '</select>';
    else ctl = '<input class="input" id="' + id + '" name="' + (o.name || id) + '" type="' + (o.type || 'text') + '"' + (o.value != null ? ' value="' + esc(o.value) + '"' : '') + dd + (o.attrs || '') + '>';
    return '<div class="field' + (o.cls ? ' ' + o.cls : '') + '" id="' + id + '-f"><label for="' + id + '">' + o.label + '</label>' + (o.hint ? '<p class="hint" id="' + id + '-h">' + o.hint + '</p>' : '') + ctl + '</div>';
  };
  SB.radios = function (name, items, val, legend, cls) {
    return '<fieldset class="radios ' + (cls || '') + '"><legend>' + legend + '</legend>' + items.map(function (it) {
      return '<label class="radio"><input type="radio" name="' + name + '" value="' + esc(it[0]) + '"' + (String(it[0]) === String(val) ? ' checked' : '') + '><span>' + it[1] + '</span></label>';
    }).join('') + '</fieldset>';
  };
  SB.seg = function (act, items, cur, label) {
    return '<div class="seg" role="group" aria-label="' + esc(label) + '">' + items.map(function (it) {
      return '<button type="button" class="seg-btn" data-act="' + act + '" data-v="' + esc(it[0]) + '" aria-pressed="' + (String(it[0]) === String(cur)) + '">' + it[1] + '</button>';
    }).join('') + '</div>';
  };
  SB.meter = function (val, max, label) { return '<progress class="meter" max="' + max + '" value="' + Math.max(0, Math.min(max, val)) + '" aria-label="' + esc(label) + '">' + nf(val, 0) + ' of ' + nf(max, 0) + '</progress>'; };
  SB.notice = function (html, kind) { return '<div class="notice ' + (kind || 'info') + '"' + (kind === 'err' ? ' role="alert"' : '') + '>' + html + '</div>'; };
  SB.empty = function (html) { return '<div class="empty">' + html + '</div>'; };
  SB.tableWrap = function (label, inner) { return '<div class="table-wrap" role="region" aria-label="' + esc(label) + '" tabindex="0">' + inner + '</div>'; };
  SB.link = function (route, text, cls) { return '<a href="#' + route + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + text + '</a>'; };
  SB.symLink = function (s) { return '<a href="#quote-' + s.sym + '"><strong>' + s.sym + '</strong><span class="sr"> ' + esc(s.name) + '</span></a>'; };

  /* ---------- feedback ---------- */
  SB.toast = function (msg, kind) {
    const box = document.getElementById('toasts'); if (!box) return;
    const el = document.createElement('div'); el.className = 'toast ' + (kind || 'info');
    el.innerHTML = '<span>' + esc(msg) + '</span><button type="button" class="btn btn-ghost btn-sm" data-act="toast-close" aria-label="Dismiss message">✕</button>';
    box.appendChild(el); setTimeout(function () { if (el.parentNode) el.remove(); }, 10000);
  };
  SB.dialog = function (title, html) {
    const d = document.getElementById('dlg'); if (!d) return;
    d.innerHTML = '<div class="dlg-in"><div class="dlg-head"><h2 id="dlg-title">' + esc(title) + '</h2><button type="button" class="btn btn-ghost btn-sm" data-act="dlg-close">Close<span class="sr"> dialog</span> ✕</button></div><div class="dlg-body">' + html + '</div></div>';
    d.setAttribute('aria-labelledby', 'dlg-title');
    SB.ui.opener = document.activeElement;
    if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  };
  SB.closeDialog = function () { const d = document.getElementById('dlg'); if (!d) return; if (d.close) d.close(); else d.removeAttribute('open'); };

  /* ---------- charts (SVG, with text alternatives) ---------- */
  let cid = 0;
  SB.lineChart = function (vals, o) {
    o = o || {}; const w = 640, h = o.h || 250, pl = 64, pr = 14, pt = 14, pb = 30;
    const fmt = o.fmt || function (v) { return SB.money(v, v >= 1000 ? 0 : 2); };
    if (!vals || vals.length < 2) return '<p class="muted">Not enough data to chart yet.</p>';
    let mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    const pad = (mx - mn) * 0.1 || Math.abs(mx) * 0.01 || 1, lo = mn - pad, hi = mx + pad;
    const x = function (i) { return pl + (w - pl - pr) * (i / (vals.length - 1)); };
    const y = function (v) { return pt + (h - pt - pb) * (1 - (v - lo) / (hi - lo)); };
    let d = ''; vals.forEach(function (v, i) { d += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
    const area = d + 'L' + x(vals.length - 1).toFixed(1) + ' ' + (h - pb) + 'L' + pl + ' ' + (h - pb) + 'Z';
    let grid = '';
    for (let k = 0; k < 4; k++) { const v = lo + (hi - lo) * (k / 3), yy = y(v).toFixed(1); grid += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + yy + '" y2="' + yy + '" class="gl"/><text x="' + (pl - 8) + '" y="' + (+yy + 4) + '" text-anchor="end" class="ax">' + esc(fmt(v)) + '</text>'; }
    const labs = o.labels || ['', '', ''];
    const xl = '<text x="' + pl + '" y="' + (h - 8) + '" class="ax">' + esc(labs[0]) + '</text><text x="' + ((pl + w - pr) / 2) + '" y="' + (h - 8) + '" text-anchor="middle" class="ax">' + esc(labs[1]) + '</text><text x="' + (w - pr) + '" y="' + (h - 8) + '" text-anchor="end" class="ax">' + esc(labs[2]) + '</text>';
    const id = 'ch' + (++cid), first = vals[0], last = vals[vals.length - 1];
    const desc = 'Starts at ' + fmt(first) + ' and ends at ' + fmt(last) + ', a change of ' + nf((last / first - 1) * 100, 2) + ' percent. Lowest ' + fmt(mn) + ', highest ' + fmt(mx) + '.';
    return '<figure class="chart"><svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-labelledby="' + id + 't ' + id + 'd" class="linechart"><title id="' + id + 't">' + esc(o.title || 'Line chart') + '</title><desc id="' + id + 'd">' + esc(desc) + '</desc>' + grid + '<path d="' + area + '" class="area"/><path d="' + d + '" class="ln"/>' + xl + '</svg><figcaption class="sr">' + esc((o.title || 'Chart') + '. ' + desc) + '</figcaption></figure>';
  };
  SB.PALETTE = ['#0B5C8A', '#B45309', '#00796B', '#6A4C93', '#5F6B76', '#A61E4D'];
  SB.donut = function (items, o) {
    o = o || {}; const total = items.reduce(function (t, i) { return t + i.value; }, 0);
    if (total <= 0) return '<p class="muted">Nothing to show yet.</p>';
    const r = 62, c = 2 * Math.PI * r; let off = 0, segs = '';
    items.forEach(function (it, i) {
      const len = it.value / total * c, gap = items.length > 1 ? 2 : 0;
      segs += '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="' + SB.PALETTE[i % SB.PALETTE.length] + '" stroke-width="26" stroke-dasharray="' + Math.max(0, len - gap).toFixed(2) + ' ' + (c - Math.max(0, len - gap)).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 90 90)"/>';
      off += len;
    });
    const legend = '<ul class="legend">' + items.map(function (it, i) {
      return '<li><span class="swatch sw' + (i % SB.PALETTE.length) + '" aria-hidden="true"></span><span class="lg-name">' + esc(it.label) + '</span><span class="lg-val">' + (o.pct ? '' : SB.money(it.value, o.d == null ? 0 : o.d) + ' · ') + nf(it.value / total * 100, 1) + '%</span></li>';
    }).join('') + '</ul>';
    return '<div class="donut-wrap"><svg viewBox="0 0 180 180" aria-hidden="true" focusable="false" class="donut">' + segs + '<text x="90" y="86" text-anchor="middle" class="dt1">' + esc(o.center || 'Total') + '</text><text x="90" y="104" text-anchor="middle" class="dt2">' + esc(o.pct ? nf(total, 0) + '%' : SB.money(total, 0)) + '</text></svg>' + legend + '</div>';
  };
  SB.rangeData = function (s, r) {
    if (r === '1D') { if (SB.feed) SB.feed.ensureIntraday(s); return { v: s.intra, labels: ['Prior close', 'Today', 'Now'] }; }
    const n = { '1M': 22, '3M': 63, '6M': 126, '1Y': 252 }[r] || 22;
    const L = SB.dates.length, v = s.hist.slice(L - n), f = function (d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    return { v: v, labels: [f(SB.dates[L - n]), f(SB.dates[L - Math.round(n / 2)]), f(SB.dates[L - 1])] };
  };

  /* ---------- compact data tables ---------- */
  SB.csv = function (rows) {
    return rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n');
  };
  SB.copy = function (text) {
    return new Promise(function (res) {
      try { navigator.clipboard.writeText(text).then(function () { res(true); }, function () { res(false); }); } catch (e) { res(false); }
    });
  };
})();
