/* SnowBull chat UI — framework-free, CSP-safe (no inline script/style, no eval). Shared by the standalone app and the
 * SnowBall+ embed.   SnowBullUI.mount(el, { endpoint, getContext, storageKey, heading, headingTag })
 * Talks to the Vercel API; if that is unreachable it falls back to the same RAG engine running in the browser
 * (window.SnowBull) so the assistant and its risk checks keep working offline. */
(function () {
  'use strict';
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const safeUrl = function (u) { return /^https?:\/\//i.test(u || '') ? u : ''; };
  const MARK = '<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#0B2A3C" stroke-width="2"/><path d="M16 7v18M7 16h18M9.6 9.6l12.8 12.8M22.4 9.6L9.6 22.4" stroke="#0B2A3C" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON = { high: '⛔', medium: '⚠️', low: 'ℹ️' }, WORD = { high: 'High risk', medium: 'Caution', low: 'Note' };
  const STARTERS = ['How should I start investing?', 'How do I spot an investment scam?', 'What is diversification?', 'Is this offer safe? “Guaranteed 10% a month, act now”'];

  /* tiny, safe markdown: **bold**, "- " bullets, [n] citations, paragraphs. Input is escaped first. */
  function md(text) {
    const lines = esc(text).split('\n'); let html = '', list = false;
    const inline = function (s) { return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[(\d{1,2})\]/g, '<sup class="sbl-cite" title="Source $1">[$1]</sup>'); };
    lines.forEach(function (l) {
      if (/^\s*[-•]\s+/.test(l)) { if (!list) { html += '<ul>'; list = true; } html += '<li>' + inline(l.replace(/^\s*[-•]\s+/, '')) + '</li>'; }
      else { if (list) { html += '</ul>'; list = false; } if (l.trim()) html += '<p>' + inline(l) + '</p>'; }
    });
    return html + (list ? '</ul>' : '');
  }

  function mount(root, opt) {
    opt = opt || {};
    const uid = 'sbl' + Math.random().toString(36).slice(2, 7), key = opt.storageKey || 'snowbull.chat.v1';
    const starters = function () { try { return (opt.starters && opt.starters()) || STARTERS; } catch (e) { return STARTERS; } };
    let history = [], busy = false, online = null;
    try { history = JSON.parse(sessionStorage.getItem(key) || '[]').slice(-30); } catch (e) { history = []; }
    const H = opt.headingTag || 'h2';
    root.innerHTML =
      '<section class="sbl" aria-labelledby="' + uid + '-h">' +
      '<div class="sbl-head"><span class="sbl-mark">' + MARK + '</span><' + H + ' id="' + uid + '-h">' + esc(opt.heading || 'SnowBull') + '<span class="sbl-ai">AI</span></' + H + '>' +
      '<span class="sbl-status" id="' + uid + '-st"><span class="sbl-dot off" aria-hidden="true"></span><span>Ready</span></span>' + (opt.closeButton ? '<button type="button" class="sbl-x" data-sbl="close" aria-label="Close SnowBull">✕</button>' : '') + '</div>' +
      '<div class="sbl-log" id="' + uid + '-log" role="log" aria-live="polite" aria-relevant="additions" tabindex="0" aria-label="Conversation with SnowBull"></div>' +
      '<div class="sbl-foot"><div class="sbl-chips" id="' + uid + '-chips" role="group" aria-label="Suggested questions"></div>' +
      '<form class="sbl-form" id="' + uid + '-f" autocomplete="off"><label class="sbl-sr" for="' + uid + '-in">Ask SnowBull</label>' +
      '<textarea id="' + uid + '-in" rows="1" maxlength="1500" placeholder="Ask about a stock, your portfolio, or paste a suspicious offer…"></textarea><button type="submit" class="sbl-send" id="' + uid + '-go">Ask</button></form>' +
      '<div class="sbl-meta"><button type="button" class="sbl-clear" data-sbl="clear">Clear conversation</button><span>Never share passwords, codes or card numbers here.</span></div>' +
      '<p class="sbl-disc">SnowBull gives educational information, not personalised investment advice. Investing involves risk, including loss of principal.</p></div></section>';
    const $ = function (s) { return root.querySelector('#' + uid + '-' + s); };
    const log = $('log'), input = $('in'), go = $('go'), chips = $('chips'), st = $('st');

    function status(text, on) { st.innerHTML = '<span class="sbl-dot' + (on ? '' : ' off') + '" aria-hidden="true"></span><span>' + esc(text) + '</span>'; }
    function setChips(list) { chips.innerHTML = (list || []).slice(0, 4).map(function (q) { return '<button type="button" class="sbl-chip" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join(''); }
    function scroll() { log.scrollTop = log.scrollHeight; }

    function riskHtml(risks) {
      if (!risks || !risks.length) return '';
      return '<div class="sbl-risks" role="group" aria-label="Risk warnings">' + risks.slice(0, 5).map(function (r) {
        return '<div class="sbl-risk ' + esc(r.level) + '"><p class="sbl-risk-t"><span aria-hidden="true">' + (ICON[r.level] || '') + '</span><span class="sbl-lvl">' + (WORD[r.level] || '') + '</span><span>' + esc(r.title) + '</span></p><p>' + esc(r.why) + '</p><p class="sbl-do">What to do: ' + esc(r.action) + '</p></div>';
      }).join('') + '</div>';
    }
    function botHtml(m) {
      const src = (m.sources || []).map(function (s, i) {
        const u = safeUrl(s.url), name = esc(s.source ? s.title + ' — ' + s.source : s.title);
        return '<li>[' + (i + 1) + '] ' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + name + '<span class="sbl-sr"> (opens in a new tab)</span></a>' : name) + (s.live ? ' <span class="sbl-pill live">live</span>' : '') + '</li>';
      }).join('');
      const meta = '<div class="sbl-meta">' + (m.mode === 'rag+llm' ? '<span class="sbl-pill">RAG + AI</span>' : m.mode === 'offline' ? '<span class="sbl-pill">Offline mode</span>' : '<span class="sbl-pill">Grounded in sources</span>') +
        (m.live && (m.live.quotes || m.live.news) ? '<span class="sbl-pill live">live data</span>' : '') + (m.confidence != null && m.intent !== 'greeting' ? '<span>Confidence: ' + (m.confidence >= 0.7 ? 'high' : m.confidence >= 0.4 ? 'medium' : 'low') + '</span>' : '') + '</div>';
      return riskHtml(m.risks) + '<div class="sbl-bubble">' + md(m.answer) + '</div>' + (src ? '<ul class="sbl-sources" aria-label="Sources">' + src + '</ul>' : '') + meta;
    }
    function paint() {
      if (!history.length) history.push({ role: 'assistant', content: '', welcome: true });
      log.innerHTML = history.map(function (m) {
        if (m.role === 'user') return '<div class="sbl-msg user"><span class="sbl-who">You</span><div class="sbl-bubble">' + esc(m.content).replace(/\n/g, '<br>') + '</div></div>';
        if (m.welcome) return '<div class="sbl-msg bot"><span class="sbl-who">SnowBull</span><div class="sbl-bubble"><p>Hi, I’m <strong>SnowBull</strong>. I answer from a vetted investing library and live market data, <strong>show my sources</strong>, and scan every question for <strong>scam and trading-risk warning signs</strong>.</p><p>Ask about a ticker, your portfolio, or paste a suspicious offer.</p></div></div>';
        return '<div class="sbl-msg bot"><span class="sbl-who">SnowBull</span>' + botHtml(m) + '</div>';
      }).join('') + (busy ? '<div class="sbl-msg bot"><span class="sbl-who">SnowBull</span><div class="sbl-bubble sbl-typing">Checking sources and live data…</div></div>' : '');
      scroll();
    }
    function save() { try { sessionStorage.setItem(key, JSON.stringify(history.slice(-30).map(function (m) { return m.role === 'user' ? m : { role: 'assistant', content: m.content, welcome: m.welcome, answer: m.answer, sources: m.sources, risks: m.risks, mode: m.mode, live: m.live, confidence: m.confidence, intent: m.intent, followups: m.followups }; }))); } catch (e) { /* storage blocked */ } }

    function context() { try { return (opt.getContext && opt.getContext()) || {}; } catch (e) { return {}; } }
    function api(body) {
      if (!opt.endpoint) return Promise.reject(new Error('no endpoint'));
      const c = new AbortController(), t = setTimeout(function () { c.abort(); }, 25000);
      return fetch(opt.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: c.signal })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) { const e = new Error(j && j.error || 'HTTP ' + r.status); e.status = r.status; throw e; } return j; }); })
        .then(function (j) { clearTimeout(t); return j; }, function (e) { clearTimeout(t); throw e; });
    }
    function offline(body) {
      if (!window.SnowBull) throw new Error('engine missing');
      const r = window.SnowBull.answer({ message: body.message, history: body.history, context: body.context });
      r.mode = 'offline'; r.retrieved = []; return r;
    }

    function ask(text) {
      text = String(text || '').trim(); if (!text || busy) return;
      history = history.filter(function (m) { return !m.welcome; });
      history.push({ role: 'user', content: text }); busy = true; go.disabled = true; setChips([]); paint(); status('Thinking…', true);
      const body = { message: text, history: history.slice(-9, -1).map(function (m) { return { role: m.role, content: m.answer || m.content }; }), context: context() };
      api(body).catch(function (e) {
        if (e && e.status === 429) throw e;
        try { const r = offline(body); online = false; return r; } catch (e2) { throw e; }
      }).then(function (r) {
        if (r.mode !== 'offline') online = true;
        history.push({ role: 'assistant', content: r.answer, answer: r.answer, sources: r.sources, risks: r.risks, mode: r.mode, live: r.live, confidence: r.confidence, intent: r.intent, followups: r.followups });
        setChips(r.followups && r.followups.length ? r.followups : starters());
      }, function (e) {
        history.push({ role: 'assistant', content: e && e.status === 429 ? 'You are asking very quickly. Please wait a minute and try again.' : 'Sorry, I could not answer that just now. Please try again.', answer: e && e.status === 429 ? 'You are asking very quickly. Please wait a minute and try again.' : 'Sorry, I could not answer that just now. Please try again.', sources: [], risks: [], mode: 'error' });
        setChips(starters());
      }).then(function () { busy = false; go.disabled = false; status(online === false ? 'Offline mode' : 'Online', online !== false); save(); paint(); input.focus({ preventScroll: true }); });
    }

    root.addEventListener('click', function (e) {
      const c = e.target.closest('[data-q]'); if (c) { ask(c.dataset.q); return; }
      const b = e.target.closest('[data-sbl]'); if (!b) return;
      if (b.dataset.sbl === 'clear') { history = []; save(); paint(); setChips(starters()); input.focus(); }
      if (b.dataset.sbl === 'close' && opt.onClose) opt.onClose();
    });
    $('f').addEventListener('submit', function (e) { e.preventDefault(); const v = input.value; input.value = ''; ask(v); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('f').requestSubmit(); } });

    paint(); setChips(starters());
    if (opt.endpoint) {
      const h = opt.endpoint.replace(/chat$/, 'health');
      fetch(h).then(function (r) { return r.json(); }).then(function (j) { online = !!j.ok; status(j.ok ? (j.llm ? 'Online · AI' : 'Online') : 'Offline mode', !!j.ok); }, function () { online = false; status('Offline mode', false); });
    } else { online = false; status('Offline mode', false); }
    return { ask: ask, focus: function () { input.focus(); }, el: root };
  }
  window.SnowBullUI = { mount: mount, md: md };
})();
