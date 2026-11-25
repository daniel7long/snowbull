const assert = require('assert');
const SB = require('../public/core/snowbull-core.js');
const ids = (r) => r.risks.map((x) => x.id);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('retrieves diversification', () => {
  const r = SB.answer({ message: 'What is diversification?' });
  assert(r.sources.some((s) => s.id === 'diversification'), JSON.stringify(r.sources));
});
t('rate/bond question', () => {
  const r = SB.answer({ message: 'Why do bond prices fall when interest rates rise?' });
  assert(r.sources.some((s) => s.id === 'rates-bond-prices'));
});
t('guaranteed returns flagged high', () => {
  const r = SB.answer({ message: 'A guy on Telegram guarantees 10% a month, act now, send USDT. Is this a scam?' });
  ['guaranteed', 'unrealistic', 'pressure', 'payment'].forEach((id) => assert(ids(r).includes(id), id + ' missing: ' + ids(r)));
  assert(r.answer.startsWith('**Risk alert'));
});
t('credentials request', () => assert(ids(SB.answer({ message: 'support asked me to share my seed phrase' })).includes('credentials')));
t('chinese scam terms', () => assert(ids(SB.answer({ message: '老师带单，稳赚不赔，保本翻倍' })).includes('guaranteed')));
t('leveraged etf', () => { const r = SB.answer({ message: 'Should I put money in TQQQ?', context: { symbols: [{ sym: 'TQQQ', name: 'x', price: 50, prev: 49, type: 'etf', src: 'real' }] } }); assert(ids(r).includes('leveraged-etf')); });
t('quote with live data and unusual move', () => {
  const r = SB.answer({ message: 'How is NVDA doing today?', context: { symbols: [{ sym: 'NVDA', name: 'NVIDIA', price: 120, prev: 100, type: 'stock', src: 'real' }], news: [{ title: 'NVIDIA jumps after earnings beat', ts: Date.now() - 3600e3 }] } });
  assert(/\$120\.00/.test(r.answer)); assert(ids(r).includes('unusual-move')); assert(/earnings beat/.test(r.answer));
});
t('no fabricated price', () => { const r = SB.answer({ message: 'price of ZZZZ?' }); assert(!/\$\d/.test(r.answer)); });
t('abstains when unknown', () => assert(/reliable source/.test(SB.answer({ message: 'blorptastic quantum zebra' }).answer)));
t('allocation profile', () => { const a = SB.allocation(SB.parseProfile('I am 30, invest 30 years, moderate risk')); assert(a.stocks >= 80 && a.stocks + a.bonds + a.cash === 100); const b = SB.allocation({ years: 2 }); assert(b.stocks <= 20); });
t('advice intent includes mix', () => assert(/Stocks \d+%/.test(SB.answer({ message: 'How should I start investing?' }).answer)));
t('portfolio concentration', () => {
  const r = SB.answer({ message: 'review my portfolio', context: { portfolio: { total: 1000, cash: 50, positions: [{ sym: 'TSLA', type: 'stock', value: 700 }, { sym: 'SPY', type: 'etf', value: 250 }] } } });
  assert(ids(r).includes('p-concentration'));
});
t('benign question has no high risk', () => assert(!SB.answer({ message: 'What is an ETF?' }).risks.some((x) => x.level === 'high')));
t('prompt builds', () => { const i = { message: 'What is an ETF?' }; const p = SB.buildPrompt(SB.answer(i), i); assert(p.user.includes('SOURCES')); });
t('guaranteed 10x', () => assert(ids(SB.answer({ message: 'friend says guaranteed 10x on this coin' })).includes('guaranteed')));
t('sentence split keeps urls', () => assert(/brokercheck\.finra\.org/.test(SB.answer({ message: 'How do I verify a broker?' }).answer)));
console.log(n + ' passed');
