/* SnowBall+ — interface language. English is the source text; other languages are applied
 * by translating the rendered page (text, labels, placeholders), so every screen switches at once.
 * Anything without a translation simply stays in English. Packs are added with SB.i18n.add(). */
(function () {
  'use strict';
  const SB = window.SB, KEY = 'sb_lang';
  const LANGS = [['en', 'English'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['es', 'Español'], ['ja', '日本語'], ['ko', '한국어'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt-BR', 'Português']];
  let lang = 'en';
  try { const v = localStorage.getItem(KEY); if (v && LANGS.some(function (l) { return l[0] === v; })) lang = v; } catch (e) { /* storage blocked */ }
  const I = SB.i18n = { lang: lang, LANGS: LANGS, packs: {} };
  SB.lang = lang;
  I.add = function (name, pack) { I.packs[name] = pack; if (name === lang) prepare(); };

  let D = null, F = null, FM = null, cache = {}, cacheN = 0;
  const esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  function prepare() {
    const pack = I.packs[lang]; if (!pack) return;
    D = pack.exact || {}; FM = {};
    Object.keys(pack.frag || {}).forEach(function (k) { FM[k] = pack.frag[k]; });
    if (pack.noFrag) { F = null; cache = {}; cacheN = 0; return; }
    Object.keys(D).forEach(function (k) { if ((k.length >= 16 || (k.length >= 12 && /[ \d]/.test(k))) && !(k in FM)) FM[k] = D[k]; });
    const keys = Object.keys(FM).sort(function (a, b) { return b.length - a.length; });
    F = new RegExp(keys.map(function (k) { return (/^[A-Za-z]/.test(k) ? '(?<![A-Za-z])' : '') + esc(k) + (/[A-Za-z]$/.test(k) ? '(?![A-Za-z])' : ''); }).join('|'), 'g');
    cache = {}; cacheN = 0;
  }

  /* sentences whose parts change at run time (numbers, names, order descriptions) */
  const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  function dates(s) {
    return s.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})\b/g, function (m, mo, y) { return y + '年' + MON[mo] + '月'; })
      .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? (\d{1,2})(?:, (\d{4}))?(?![\d:])/g, function (m, mo, d, y) { return (y ? y + '年' : '') + MON[mo] + '月' + d + '日'; })
      .replace(/(\d{1,2}:\d{2}) ?AM\b/g, '上午 $1').replace(/(\d{1,2}:\d{2}) ?PM\b/g, '下午 $1');
  }
  function orderType(t) {
    let m;
    if (t === 'Market') return '市价';
    if ((m = t.match(/^Limit ?(.*)$/))) return '限价 ' + m[1];
    if ((m = t.match(/^Stop (\S+) \/ limit (\S+)$/))) return '止损 ' + m[1] + ' / 限价 ' + m[2];
    if ((m = t.match(/^Stop ?(.*)$/))) return '止损 ' + m[1];
    return t;
  }
  function order(d) {
    const m = d.match(/^(Buy|Sell) ([\d.,]+) (share|shares|bond|bonds) of (\S+) — (.+)$/);
    if (!m) return null;
    return (m[1] === 'Buy' ? '买入' : '卖出') + ' ' + m[2] + ' ' + (/bond/.test(m[3]) ? '张' : '股') + ' ' + m[4] + ' — ' + orderType(m[5]);
  }
  const RULES_ZH = [
    [/^(.+) ([▲▼])$/, function (m, tr) { return tr(m[1]) + ' ' + m[2]; }],
    [/^(Stocks|Bonds|Economy|Markets|Funds & ETFs) · (.+?) ·\s*$/, function (m, tr) { return tr(m[1]) + ' · ' + tr(m[2]) + ' ·'; }],
    [/^(\d+) stories$/, function (m) { return m[1] + ' 篇新闻'; }],
    [/^(\d+) results?$/, function (m) { return m[1] + ' 条结果'; }],
    [/^Investments (\S+) · Cash (\S+)$/, function (m) { return '投资 ' + m[1] + ' · 现金 ' + m[2]; }],
    [/^Includes (\S+) at SnowBall\+$/, function (m) { return '其中 ' + m[1] + ' 在 SnowBall+'; }],
    [/^Cash available (\S+)$/, function (m) { return '可用现金 ' + m[1]; }],
    [/^You have (\d+) of this type\.$/, function (m) { return '您已有 ' + m[1] + ' 个此类账户。'; }],
    [/^Weight for (\S+) in percent$/, function (m) { return m[1] + ' 的权重（百分比）'; }],
    [/^P\/E (\S+) · Yield (\S+)$/, function (m) { return '市盈率 ' + m[1] + ' · 收益率 ' + m[2]; }],
    [/^Expense (\S+) · Yield (\S+)$/, function (m) { return '费用率 ' + m[1] + ' · 收益率 ' + m[2]; }],
    [/^YTM (\S+) · Coupon (\S+)$/, function (m) { return '到期收益率 ' + m[1] + ' · 票息 ' + m[2]; }],
    [/^by (\d{4}) · Saved so far (\S+) · Saving (\S+?)\/month$/, function (m) { return '目标年份 ' + m[1] + ' · 目前已存 ' + m[2] + ' · 每月储蓄 ' + m[3]; }],
    [/^(\$[\d,.]+)\/month$/, function (m) { return m[1] + '/月'; }],
    [/^Referral code (.+)$/, function (m) { return '推荐码 ' + m[1]; }],
    [/^Projected (\S+) \((\d+)% of goal\)\.( Saving about)?$/, function (m) { return '预计 ' + m[1] + '（占目标的 ' + m[2] + '%）。' + (m[3] ? '每月储蓄约' : ''); }],
    [/^Projected (\S+) \((\d+)% of goal\)\.(?: Saving about (\S+?)\/month would reach it\.)?$/, function (m) { return '预计 ' + m[1] + '（占目标的 ' + m[2] + '%）。' + (m[3] ? '每月储蓄约 ' + m[3] + ' 即可达成。' : ''); }],
    [/^(.+) shares (climb|rise|gain|advance|edge higher|slip|fall|drop|retreat|edge lower) ([\d.]+)% on (.+)$/, function (m, tr) {
      const V = { climb: '上涨', rise: '上升', gain: '上涨', advance: '走高', 'edge higher': '小幅走高', slip: '小幅下滑', fall: '下跌', drop: '下挫', retreat: '回落', 'edge lower': '小幅走低' };
      return m[1] + ' 股价' + V[m[2]] + ' ' + m[3] + '%，原因：' + tr(m[4]);
    }],
    [/^(.+) moves (up|down) ([\d.]+)% on (.+)$/, function (m, tr) { return m[1] + (m[2] === 'up' ? ' 上涨 ' : ' 下跌 ') + m[3] + '%，原因：' + tr(m[4]); }],
    [/^(.+) \((\S+)\) (moved higher|moved lower) ([\d.]+)% from the prior close to (.+?) in simulated trading, driven by (.+)\.$/, function (m, tr) { return m[1] + '（' + m[2] + '）在模拟交易中' + (m[3] === 'moved higher' ? '上涨' : '下跌') + ' ' + m[4] + '%，报 ' + m[5] + '，主要受' + tr(m[6]) + '推动。'; }],
    [/^(\d+) min ago$/, function (m) { return m[1] + ' 分钟前'; }],
    [/^(\d+) hr ago$/, function (m) { return m[1] + ' 小时前'; }],
    [/^(\d+) days ago$/, function (m) { return m[1] + ' 天前'; }],
    [/^(.+) — SnowBall\+$/, function (m, tr) { return tr(m[1]) + ' — SnowBall+'; }],
    [/^(Buy|Sell) [\d.,]+ (?:shares?|bonds?) of \S+ — .+$/, function (m) { return order(m[0]); }],
    [/^(Order filled|Filled): (.+?) at (.+)\.$/, function (m) { return '订单已成交：' + (order(m[2]) || m[2]) + '，成交价 ' + m[3] + '。'; }],
    [/^Order rejected: (.+)$/, function (m, tr) { return '订单被拒绝：' + tr(m[1]); }],
    [/^Order accepted and working: (.+?)\.( The market is closed.*)?$/, function (m, tr) { return '订单已接受并在挂单中：' + (order(m[1]) || m[1]) + '。' + (m[2] ? tr(m[2].trim()) : ''); }],
    [/^Cancelled: (.+)\.$/, function (m) { return '已取消：' + (order(m[1]) || m[1]) + '。'; }],
    [/^(\$[\d.,]+) moved (from .+?) (to .+)\.$/, function (m, tr) {
      const side = function (s) { return s.replace(/^from your linked checking account$/, '从关联支票账户').replace(/^to your linked checking account$/, '转入关联支票账户').replace(/^from (.+)$/, function (x, n) { return '从 ' + tr(n); }).replace(/^to (.+)$/, function (x, n) { return '转入 ' + tr(n); }); };
      return m[1] + ' 已' + side(m[2]) + side(m[3]) + '。';
    }],
    [/^Paid (\$[\d.,]+) to (.+)\.$/, function (m) { return '已向 ' + m[2] + ' 支付 ' + m[1] + '。'; }],
    [/^Scheduled (\$[\d.,]+) to (.+?) for (\d{4}-\d\d-\d\d)\. Keep enough cash in the account by then\.$/, function (m) { return '已预约向 ' + m[2] + ' 支付 ' + m[1] + '，日期 ' + m[3] + '。请确保届时账户中有足够现金。'; }],
    [/^Simulated payout of (\$[\d.,]+) \((\$[\d.,]+) reinvested, (\$[\d.,]+) paid as cash\)\.$/, function (m) { return '模拟派息 ' + m[1] + '（' + m[2] + ' 再投资，' + m[3] + ' 以现金支付）。'; }],
    [/^Distribution of (\$[\d.,]+) requested: (\$[\d.,]+) to your checking account and (\$[\d.,]+) withheld\.$/, function (m) { return '已申请领取 ' + m[1] + '：' + m[2] + ' 转入您的支票账户，预扣 ' + m[3] + '。'; }],
    [/^Not enough available cash\. You need (\$[\d.,]+) but have (\$[\d.,]+)\. Transfer money in, or reduce the order\.$/, function (m) { return '可用现金不足。您需要 ' + m[1] + '，但只有 ' + m[2] + '。请转入资金，或减少订单金额。'; }],
    [/^You can sell up to ([\d.,]+) of (\S+) in this account \(open sell orders are reserved\)\.$/, function (m) { return '您在此账户中最多可卖出 ' + m[1] + ' 股 ' + m[2] + '（未成交卖单占用的部分除外）。'; }],
    [/^Available cash in (.+) is (\$[\d.,]+)\.$/, function (m) { return m[1] + ' 的可用现金为 ' + m[2] + '。'; }],
    [/^(.+) opened \((.+)\)\.$/, function (m) { return '已开立 ' + m[1] + '（' + m[2] + '）。'; }],
    [/^(.+) (added to watchlist|removed from watchlist)\.$/, function (m) { return m[1] + (m[2][0] === 'a' ? ' 已加入自选。' : ' 已从自选中移除。'); }],
    [/^(.+) added as a payee\.$/, function (m) { return '已添加收款方 ' + m[1] + '。'; }],
    [/^(.+) added to Full View\.$/, function (m) { return m[1] + ' 已添加到全景视图。'; }],
    [/^(.+) added as a beneficiary\.$/, function (m) { return '已添加受益人 ' + m[1] + '。'; }],
    [/^Goal “(.+)” added\.$/, function (m) { return '目标“' + m[1] + '”已添加。'; }],
    [/^Please answer question (\d+)\.$/, function (m) { return '请回答第 ' + m[1] + ' 题。'; }],
    [/^(\d+) of (\d+) lessons completed$/, function (m) { return '已完成 ' + m[1] + ' / ' + m[2] + ' 节课'; }],
    [/^(Latest NAV|Last trade|Last close)(?: as of (.+?))?\. May be delayed\.$/, function (m) { return { 'Latest NAV': '最新净值', 'Last trade': '最新成交', 'Last close': '上次收盘' }[m[1]] + (m[2] ? '（截至 ' + dates(m[2]) + '）' : '') + '。数据可能有延迟。'; }],
    [/^Real data for this (security|mutual fund) is not available from the free data plan, so this price is practice-only\.$/, function (m) { return '免费数据方案不提供该' + (m[1] === 'security' ? '证券' : '共同基金') + '的真实数据，因此此价格仅供练习。'; }],
    [/^Yield from (.+?); the price is modeled for a bond with this coupon and maturity\.$/, function (m) { return '收益率来自 ' + (m[1].indexOf('FRED') === 0 ? 'FRED（美国财政部 / ICE 数据）' : m[1]) + '；价格按具有该票息和到期期限的债券建模。'; }],
  ];

  const COMMON = [
    [/^(.+) — SnowBall\+$/, function (m, tr) { return tr(m[1]) + ' — SnowBall+'; }],
    [/^(.+) ([▲▼])$/, function (m, tr) { return tr(m[1]) + ' ' + m[2]; }]
  ];
  function rules() { return lang === 'zh-CN' ? COMMON.concat(RULES_ZH) : COMMON; }

  function tr(text) {
    if (!D || typeof text !== 'string') return text;
    const mm = text.match(/^(\s*)([\s\S]*?)(\s*)$/), core = mm[2];
    if (!core || !/[A-Za-z]{2}/.test(core)) return text;
    let out = cache[core];
    if (out === undefined) {
      out = D[core];
      if (out === undefined) {
        const R = rules(); for (let i = 0; i < R.length && out === undefined; i++) { const m = core.match(R[i][0]); if (m) out = R[i][1](m, tr); }
      }
      if (out === undefined) { if (F) { out = core.replace(F, function (x) { return FM[x]; }); if (lang === 'zh-CN') out = dates(out); } else out = core; }
      if (cacheN > 6000) { cache = {}; cacheN = 0; }
      cache[core] = out; cacheN++;
    }
    return mm[1] + out + mm[3];
  }
  I.tr = tr;
  SB.t = function (s) { return lang === 'en' ? s : tr(s); };

  /* ---------- applying to the page ---------- */
  const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1) return;
    const tag = root.tagName; if (tag === 'SCRIPT' || tag === 'STYLE') return;
    fixAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) { if (n.parentNode && n.parentNode.tagName !== 'SCRIPT' && n.parentNode.tagName !== 'STYLE') fixText(n); } else fixAttrs(n); }
  }
  function fixText(n) { const v = n.nodeValue, t = tr(v); if (t !== v) n.nodeValue = t; }
  function fixAttrs(el) {
    for (let i = 0; i < ATTRS.length; i++) { const a = ATTRS[i]; if (el.hasAttribute && el.hasAttribute(a)) { const v = el.getAttribute(a), t = tr(v); if (t !== v) el.setAttribute(a, t); } }
    if (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button')) { const t = tr(el.value); if (t !== el.value) el.value = t; }
  }
  I.apply = walk;

  I.start = function () {
    document.documentElement.lang = lang;
    const sel = document.getElementById('lang-switch');
    if (sel) { sel.innerHTML = LANGS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === lang ? ' selected' : '') + '>' + l[1] + '</option>'; }).join(''); }
    if (lang === 'en' || !D) return;
    walk(document.body);
    const t = document.querySelector('title'); if (t) { const v = t.textContent, x = tr(v); if (x !== v) t.textContent = x; }
    let busy = false;
    const mo = new MutationObserver(function (list) {
      if (busy) return; busy = true;
      try {
        list.forEach(function (m) {
          if (m.type === 'characterData') fixText(m.target);
          else if (m.type === 'attributes') { if (m.target.nodeType === 1) fixAttrs(m.target); }
          else m.addedNodes.forEach(function (n) { walk(n); });
        });
      } finally { busy = false; }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    const ti = document.querySelector('title');
    if (ti) new MutationObserver(function () { const v = ti.textContent, x = tr(v); if (x !== v) ti.textContent = x; }).observe(ti, { childList: true, characterData: true, subtree: true });
  };
  SB.changes.lang = function (sel) {
    try { localStorage.setItem(KEY, sel.value); } catch (e) { /* storage blocked */ }
    location.reload();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', I.start); else I.start();
})();
