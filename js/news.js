/* SnowBall+ — simulated news feed, used only when the real-data backend is not available (see live.js). */
(function () {
  'use strict';
  const SB = window.SB;
  SB.news = [];
  let nid = 0;
  const UP = ['stronger-than-expected demand', 'a wave of analyst upgrades', 'upbeat guidance from management', 'easing inflation worries', 'a rotation into growth names', 'positive customer feedback'];
  const DOWN = ['profit-taking after a strong run', 'concerns about slowing growth', 'a cautious analyst note', 'rising bond yields', 'weaker consumer sentiment', 'supply-chain headlines'];
  const VUP = ['climb', 'rise', 'gain', 'advance', 'edge higher'];
  const VDOWN = ['slip', 'fall', 'drop', 'retreat', 'edge lower'];
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  const MACRO = [
    { cat: 'Economy', title: 'Simulated central bank holds rates steady, signals patience', body: ['In this simulated policy meeting, officials left their benchmark rate unchanged and said further moves will depend on incoming inflation and jobs data.', 'Bond markets in the simulator reacted calmly, with Treasury prices little changed.'] },
    { cat: 'Economy', title: 'Consumer spending steadies as inflation cools in the simulation', body: ['A fictional monthly report showed retail spending growing at a moderate pace while price increases eased.', 'Analysts in the simulator noted that cooling inflation could give policymakers more flexibility.'] },
    { cat: 'Markets', title: 'Stocks end mixed as investors weigh earnings and rates', body: ['Simulated major indexes finished with small moves in both directions as traders balanced a busy earnings calendar against interest-rate expectations.', 'Trading volume was near its average for the simulation.'] },
    { cat: 'Bonds', title: 'Treasury yields hover near recent range', body: ['Yields on simulated government bonds moved only slightly, with the 10-year note continuing to act as the market’s benchmark.', 'Shorter-dated bills continued to offer higher yields than many savings accounts in this simulated environment.'] },
    { cat: 'Funds & ETFs', title: 'Low-cost index funds keep attracting new money', body: ['Fund flows in the simulation favored broad, low-fee index funds and ETFs for a third straight month.', 'Fee competition has pushed expense ratios on some index funds to zero.'] },
    { cat: 'Economy', title: 'Job openings ease while hiring stays solid', body: ['A simulated labor report pointed to a gradual cooling in openings without a sharp rise in layoffs.', 'Economists in the simulator described the labor market as balanced.'] }
  ];

  SB.makeStory = function (s, ts, r) {
    r = r || Math.random;
    const chg = (s.price / s.prev - 1) * 100, up = chg >= 0, a = Math.abs(chg).toFixed(1);
    const topic = pick(r, up ? UP : DOWN), verb = pick(r, up ? VUP : VDOWN);
    const cat = s.type === 'stock' ? 'Stocks' : s.type === 'bond' ? 'Bonds' : 'Funds & ETFs';
    const title = s.type === 'stock' ? s.name.replace(/ Inc\.| Corp\.| Co\.|\.$/g, '') + ' shares ' + verb + ' ' + a + '% on ' + topic : s.name + (up ? ' moves ' : ' moves ') + (up ? 'up ' : 'down ') + a + '% on ' + topic;
    const px = s.type === 'bond' ? s.price.toFixed(2) + ' per $100' : '$' + s.price.toFixed(2);
    return {
      id: ++nid, ts: ts, cat: cat, sym: s.sym, title: title,
      body: [
        s.name + ' (' + s.sym + ') ' + (up ? 'moved higher' : 'moved lower') + ' ' + a + '% from the prior close to ' + px + ' in simulated trading, driven by ' + topic + '.',
        s.desc + ' Traders in the simulator were split on whether the move can last.',
        'This story was generated automatically for the SnowBall+ simulator and does not describe real events or real prices.'
      ]
    };
  };

  SB.seedNews = function () {
    const r = SB.rng(20261115), now = Date.now();
    const list = [];
    MACRO.forEach(function (m, i) { list.push({ id: ++nid, ts: now - (i * 47 + 12) * 60000, cat: m.cat, sym: null, title: m.title, body: m.body.concat(['This story was generated automatically for the SnowBall+ simulator and is not real news.']) }); });
    const movers = SB.securities.slice().sort(function (a, b) { return Math.abs(b.price / b.prev - 1) - Math.abs(a.price / a.prev - 1); }).slice(0, 8);
    movers.forEach(function (s, i) { list.push(SB.makeStory(s, now - (i * 31 + 5) * 60000, r)); });
    SB.news = list.sort(function (a, b) { return b.ts - a.ts; });
  };

  SB.newsMaybe = function () {
    if (SB.dataMode === 'real') return null;
    const now = Date.now();
    const cand = SB.securities.filter(function (s) { return s.type !== 'bond' && Math.abs(s.price / s.prev - 1) > 0.012; })
      .filter(function (s) { return !SB.news.some(function (n) { return n.sym === s.sym && now - n.ts < 10 * 60000; }); });
    if (!cand.length) return null;
    cand.sort(function (a, b) { return Math.abs(b.price / b.prev - 1) - Math.abs(a.price / a.prev - 1); });
    const st = SB.makeStory(cand[0], now);
    SB.news.unshift(st); if (SB.news.length > 60) SB.news.pop();
    return st;
  };
})();
