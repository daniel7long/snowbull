/* SnowBall+ — simulated market data. All prices, funds and bonds are fictional/simulated. */
(function () {
  'use strict';
  const SB = (window.SB = window.SB || {});
  SB.acts = {}; SB.forms = {}; SB.inputs = {}; SB.changes = {}; SB.pages = {}; SB.frag = {}; SB.ui = {};

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  SB.rng = mulberry32; SB.hash = hashStr; SB.gauss = gauss;

  SB.TYPE = { stock: 'Stock', etf: 'ETF', fund: 'Mutual fund', bond: 'Bond' };

  // sym, name, type, price, annual vol, sector/category, extras, description
  const RAW = [
    ['AAPL', 'Apple Inc.', 'stock', 232.4, 0.28, 'Technology', { div: 0.45, pe: 34, cap: 3500 }, 'Designs consumer electronics, software and online services.'],
    ['MSFT', 'Microsoft Corp.', 'stock', 418.2, 0.24, 'Technology', { div: 0.75, pe: 35, cap: 3100 }, 'Cloud computing, productivity software and gaming.'],
    ['NVDA', 'NVIDIA Corp.', 'stock', 138.5, 0.55, 'Technology', { div: 0.03, pe: 55, cap: 3400 }, 'Graphics processors and accelerators for AI workloads.'],
    ['AMZN', 'Amazon.com Inc.', 'stock', 201.3, 0.3, 'Consumer Discretionary', { div: 0, pe: 42, cap: 2100 }, 'Online retail, logistics and cloud infrastructure.'],
    ['GOOGL', 'Alphabet Inc. Class A', 'stock', 176.8, 0.28, 'Communication', { div: 0.4, pe: 24, cap: 2200 }, 'Search, advertising, video and cloud services.'],
    ['META', 'Meta Platforms Inc.', 'stock', 585.1, 0.36, 'Communication', { div: 0.35, pe: 27, cap: 1500 }, 'Social networking and messaging platforms.'],
    ['TSLA', 'Tesla Inc.', 'stock', 248.6, 0.6, 'Consumer Discretionary', { div: 0, pe: 70, cap: 800 }, 'Electric vehicles and energy storage.'],
    ['JPM', 'JPMorgan Chase & Co.', 'stock', 238.9, 0.22, 'Financials', { div: 2.1, pe: 13, cap: 680 }, 'Diversified banking and financial services.'],
    ['V', 'Visa Inc.', 'stock', 289.4, 0.2, 'Financials', { div: 0.75, pe: 30, cap: 590 }, 'Global electronic payments network.'],
    ['JNJ', 'Johnson & Johnson', 'stock', 156.2, 0.16, 'Health Care', { div: 3.2, pe: 15, cap: 380 }, 'Pharmaceuticals and medical devices.'],
    ['XOM', 'Exxon Mobil Corp.', 'stock', 114.7, 0.24, 'Energy', { div: 3.5, pe: 14, cap: 500 }, 'Integrated oil and gas producer.'],
    ['WMT', 'Walmart Inc.', 'stock', 92.3, 0.18, 'Consumer Staples', { div: 1.0, pe: 36, cap: 740 }, 'Large-format retail and e-commerce.'],
    ['KO', 'The Coca-Cola Co.', 'stock', 63.8, 0.14, 'Consumer Staples', { div: 3.0, pe: 24, cap: 275 }, 'Beverage maker with a global distribution network.'],
    ['DIS', 'The Walt Disney Co.', 'stock', 96.4, 0.26, 'Communication', { div: 0.9, pe: 20, cap: 175 }, 'Media, streaming and theme parks.'],
    ['NFLX', 'Netflix Inc.', 'stock', 842.5, 0.34, 'Communication', { div: 0, pe: 45, cap: 360 }, 'Subscription video streaming.'],
    ['PG', 'Procter & Gamble Co.', 'stock', 168.2, 0.14, 'Consumer Staples', { div: 2.4, pe: 27, cap: 395 }, 'Household and personal-care brands.'],
    ['SPY', 'SPDR S&P 500 ETF Trust', 'etf', 585.0, 0.15, 'Large Blend', { exp: 0.0945, div: 1.2 }, 'Tracks 500 large U.S. companies.'],
    ['QQQ', 'Invesco QQQ Trust', 'etf', 505.0, 0.21, 'Large Growth', { exp: 0.2, div: 0.6 }, 'Tracks 100 large Nasdaq-listed companies.'],
    ['VTI', 'Vanguard Total Stock Market ETF', 'etf', 285.0, 0.16, 'Large Blend', { exp: 0.03, div: 1.3 }, 'Broad exposure to the entire U.S. stock market.'],
    ['VXUS', 'Vanguard Total International Stock ETF', 'etf', 64.2, 0.15, 'Foreign Large Blend', { exp: 0.05, div: 3.0 }, 'Stocks of companies outside the United States.'],
    ['BND', 'Vanguard Total Bond Market ETF', 'etf', 72.4, 0.05, 'Intermediate Core Bond', { exp: 0.03, div: 3.6 }, 'Broad U.S. investment-grade bond market.'],
    ['SCHD', 'Schwab U.S. Dividend Equity ETF', 'etf', 28.1, 0.14, 'Large Value', { exp: 0.06, div: 3.5 }, 'U.S. companies with strong dividend track records.'],
    ['VNQ', 'Vanguard Real Estate ETF', 'etf', 91.5, 0.19, 'Real Estate', { exp: 0.13, div: 3.9 }, 'U.S. real estate investment trusts (REITs).'],
    ['GLD', 'SPDR Gold Shares', 'etf', 245.0, 0.15, 'Commodities', { exp: 0.4, div: 0 }, 'Tracks the price of gold bullion.'],
    ['FXAIX', 'Fidelity 500 Index Fund', 'fund', 205.3, 0.15, 'Large Blend', { exp: 0.015, div: 1.2 }, 'Index fund tracking the S&P 500.'],
    ['FZROX', 'Fidelity ZERO Total Market Index Fund', 'fund', 22.4, 0.16, 'Large Blend', { exp: 0, div: 1.2 }, 'Zero-expense-ratio index fund for the total U.S. market.'],
    ['FSKAX', 'Fidelity Total Market Index Fund', 'fund', 172.6, 0.16, 'Large Blend', { exp: 0.015, div: 1.3 }, 'Index fund covering the broad U.S. stock market.'],
    ['FSPSX', 'Fidelity International Index Fund', 'fund', 52.4, 0.15, 'Foreign Large Blend', { exp: 0.035, div: 3.0 }, 'Index fund for developed markets outside the U.S.'],
    ['FXNAX', 'Fidelity U.S. Bond Index Fund', 'fund', 10.6, 0.05, 'Intermediate Core Bond', { exp: 0.025, div: 3.5 }, 'Index fund for U.S. investment-grade bonds.'],
    ['FBALX', 'Fidelity Balanced Fund', 'fund', 31.9, 0.1, 'Allocation 50-70% Equity', { exp: 0.47, div: 1.8 }, 'Mix of stocks and bonds in a single fund.'],
    ['TBILL3M', 'U.S. Treasury Bill – 3 Month', 'bond', 98.9, 0.004, 'Treasury', { coupon: 0, years: 0.25, rating: 'AAA' }, 'Short-term government debt sold at a discount.'],
    ['UST2Y', 'U.S. Treasury Note – 2 Year', 'bond', 99.8, 0.012, 'Treasury', { coupon: 4.0, years: 2, rating: 'AAA' }, 'Two-year government note paying semiannual interest.'],
    ['UST10Y', 'U.S. Treasury Note – 10 Year', 'bond', 98.6, 0.05, 'Treasury', { coupon: 4.25, years: 10, rating: 'AAA' }, 'Ten-year government note, a common market benchmark.'],
    ['TIPS5Y', 'U.S. Treasury TIPS – 5 Year', 'bond', 101.2, 0.025, 'Treasury (inflation-protected)', { coupon: 1.5, years: 5, rating: 'AAA' }, 'Principal adjusts with inflation.'],
    ['CORP5Y', 'Corporate Bond, A-Rated – 5 Year', 'bond', 100.9, 0.03, 'Corporate', { coupon: 5.0, years: 5, rating: 'A' }, 'Investment-grade corporate debt with a higher coupon.'],
    ['MUNI10Y', 'Municipal Bond, AA – 10 Year', 'bond', 101.5, 0.04, 'Municipal (tax-exempt)', { coupon: 3.5, years: 10, rating: 'AA' }, 'Interest is generally exempt from federal income tax.']
  ];

  SB.dates = (function () {
    const d = []; const t = new Date(); t.setHours(0, 0, 0, 0);
    while (d.length < 261) { const w = t.getDay(); if (w !== 0 && w !== 6) d.unshift(new Date(t)); t.setDate(t.getDate() - 1); }
    return d;
  })();

  SB.securities = RAW.map(function (r) {
    const sym = r[0], price = r[3], vol = r[4];
    const rnd = mulberry32(hashStr(sym));
    const n = 261, hist = new Array(n); hist[n - 1] = price;
    const sd = vol / Math.sqrt(252) * 0.7;
    for (let i = n - 2; i >= 0; i--) hist[i] = hist[i + 1] * Math.exp(-(0.0003 + sd * gauss(rnd)));
    const prev = hist[n - 2];
    const m = 48, intra = [];
    for (let i = 0; i < m; i++) {
      const t = i / (m - 1);
      intra.push(prev + (price - prev) * t + (i === 0 || i === m - 1 ? 0 : prev * sd * 0.35 * gauss(rnd)));
    }
    const s = Object.assign({ sym: sym, name: r[1], type: r[2], price: price, anchor: price, prev: prev, vol: vol, sector: r[5], desc: r[7], hist: hist, intra: intra, simPrice: price, src: 'sim', hsrc: 'sim' }, r[6]);
    s.avgVol = s.type === 'stock' || s.type === 'etf' ? Math.round((2 + (hashStr(sym) % 70)) * 1e6) : null;
    s.hist[n - 1] = price;
    return s;
  });
  SB.bySym = {}; SB.securities.forEach(function (s) { SB.bySym[s.sym] = s; });

  SB.ytm = function (s) {
    if (s.type !== 'bond') return null;
    if (s.liveYield != null) return s.liveYield;
    return ((s.coupon + (100 - s.price) / s.years) / ((100 + s.price) / 2)) * 100;
  };
  // Value of one unit: 1 share, or 1 bond ($1,000 face, price quoted per $100).
  SB.unitAt = function (s, p) { return s.type === 'bond' ? p * 10 : p; };
  SB.unit = function (s) { return SB.unitAt(s, s.price); };
  SB.unitName = function (s) { return s.type === 'bond' ? 'bond' : s.type === 'fund' ? 'share' : 'share'; };

  SB.RATES = { mm: 3.9, bank: 0.4, margin: 11.8 };
  SB.MM = { sym: 'SNMM', name: 'SnowBall Government Money Market Fund', yield: 3.9, exp: 0.42 };
  SB.IRA_LIMIT = 7000; // simulated annual limit — check irs.gov for real limits

  SB.search = function (q) {
    q = String(q || '').trim().toLowerCase(); if (!q) return [];
    const out = [];
    SB.securities.forEach(function (s) {
      const sy = s.sym.toLowerCase(), nm = s.name.toLowerCase();
      let rank = -1;
      if (sy === q) rank = 0; else if (sy.indexOf(q) === 0) rank = 1; else if (nm.indexOf(q) === 0) rank = 2; else if (nm.indexOf(q) > -1 || s.sector.toLowerCase().indexOf(q) > -1) rank = 3;
      if (rank > -1) out.push({ s: s, rank: rank });
    });
    return out.sort(function (a, b) { return a.rank - b.rank || a.s.sym.localeCompare(b.s.sym); }).map(function (x) { return x.s; });
  };

  SB.MODELS = [
    { id: 'cons', name: 'Conservative', blurb: 'Prioritizes stability and income. Lower expected swings, lower expected growth.', w: { BND: 35, FXNAX: 15, UST2Y: 10, VTI: 20, SCHD: 10, VXUS: 5, TBILL3M: 5 } },
    { id: 'mcons', name: 'Moderately conservative', blurb: 'Mostly bonds and dividend payers with a measured stock allocation.', w: { BND: 25, FXNAX: 10, VTI: 30, SCHD: 10, VXUS: 10, TIPS5Y: 10, GLD: 5 } },
    { id: 'mod', name: 'Moderate', blurb: 'A balanced mix of stocks and bonds for medium-term goals.', w: { VTI: 35, VXUS: 15, SCHD: 10, BND: 20, FXNAX: 10, VNQ: 5, GLD: 5 } },
    { id: 'magg', name: 'Moderately aggressive', blurb: 'Growth-oriented with a smaller bond cushion.', w: { VTI: 40, QQQ: 10, VXUS: 20, SCHD: 10, VNQ: 5, BND: 10, GLD: 5 } },
    { id: 'agg', name: 'Aggressive', blurb: 'Designed for long horizons; expect large ups and downs.', w: { VTI: 40, QQQ: 20, VXUS: 25, VNQ: 5, SCHD: 10 } }
  ];

  SB.RMD = { 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2 };

  SB.LESSONS = {
    invest: [
      { id: 'stocks', title: 'What is a stock?', mins: 4, body: ['A share of stock is a small slice of ownership in a company. If the company grows and earns more, the share price tends to rise over time; some companies also pay part of their profits to shareholders as dividends.', 'Prices move every second as buyers and sellers agree on new values, so a stock can fall as well as rise. Owning many different companies spreads that risk.'], quiz: { q: 'What does owning a share of stock represent?', o: ['A loan to the company', 'A slice of ownership in the company', 'A guaranteed return'], a: 1, why: 'Stockholders are part-owners. Lenders hold bonds, not stock, and returns are never guaranteed.' } },
      { id: 'etf', title: 'ETFs vs. mutual funds', mins: 5, body: ['Both pool many investors’ money to buy a basket of securities. ETFs trade on an exchange all day at a changing price, just like stocks. Mutual funds are bought and sold once a day at the fund’s net asset value (NAV), often by dollar amount.', 'Index funds and ETFs simply follow a market index, which keeps costs low. Compare the expense ratio — the yearly fee as a percentage of your investment — before you buy.'], quiz: { q: 'When does a mutual fund order usually price?', o: ['Every second during market hours', 'Once per day at the NAV', 'Only on the first of the month'], a: 1, why: 'Mutual funds price once a day at the end-of-day NAV; ETFs trade continuously.' } },
      { id: 'bonds', title: 'Bond basics', mins: 5, body: ['A bond is a loan. You lend money to a government or company, and it pays you interest (the coupon) and returns the face value at maturity. In SnowBall+, one bond has a $1,000 face value and prices are quoted per $100.', 'When market interest rates rise, existing bond prices usually fall, and the reverse is true. Yield to maturity estimates your total annual return if you hold the bond until it matures.'], quiz: { q: 'If market interest rates rise, existing bond prices usually…', o: ['Rise', 'Fall', 'Stay exactly the same'], a: 1, why: 'New bonds pay more, so older, lower-paying bonds become less valuable.' } },
      { id: 'orders', title: 'Order types', mins: 5, body: ['A market order buys or sells right away at the best available price. A limit order sets the worst price you will accept, and waits until the market reaches it. A stop order becomes a market order once the price touches your stop level; a stop-limit order becomes a limit order instead.', 'Limit orders give price control but may never fill. Market orders nearly always fill but the price can differ from the last quote.'], quiz: { q: 'Which order sets the maximum price you will pay?', o: ['Market order', 'Limit buy order', 'Stop sell order'], a: 1, why: 'A limit buy fills only at your limit price or better.' } },
      { id: 'diversify', title: 'Diversification & asset allocation', mins: 5, body: ['Diversification means spreading money across different companies, sectors, countries and asset classes so that no single disappointment sinks the whole portfolio.', 'Asset allocation — your mix of stocks, bonds and cash — is a major driver of how bumpy the ride feels. Longer time horizons generally allow for more stocks; shorter ones call for more stability. Rebalance occasionally to get back to your targets.'], quiz: { q: 'What is rebalancing?', o: ['Selling everything', 'Restoring your target mix of assets', 'Picking the best stock'], a: 1, why: 'Rebalancing trims what has grown and adds to what has lagged, returning to your target allocation.' } },
      { id: 'risk', title: 'Understanding risk', mins: 4, body: ['Risk is the chance that results differ from what you expected. Volatility measures how much prices swing; it is not the same as permanent loss, but large swings can tempt people to sell at the wrong time.', 'Your risk tolerance is both your ability to absorb losses (time, income) and your willingness to sit through them. The portfolio builder’s questionnaire helps you reflect on both.'], quiz: { q: 'Higher volatility means…', o: ['Prices swing more widely', 'Prices never change', 'A guaranteed gain'], a: 0, why: 'Volatility describes the size of price swings in either direction.' } },
      { id: 'compound', title: 'The power of compounding', mins: 3, body: ['Compounding means earning returns on your earlier returns. $10,000 growing at 7% a year becomes roughly $19,700 after 10 years and $38,700 after 20.', 'Starting early and contributing regularly matters more than trying to time the market. Fees also compound — against you — so keep an eye on costs.'], quiz: { q: 'Compounding earns returns on…', o: ['Only your original deposit', 'Your deposit and past returns', 'Only your future deposits'], a: 1, why: 'Earnings are reinvested, so they generate their own earnings.' } }
    ],
    retire: [
      { id: 'iras', title: 'Roth vs. Traditional IRA', mins: 5, body: ['A Traditional IRA may give you a tax deduction now; withdrawals in retirement are generally taxed as income. A Roth IRA is funded with after-tax money; qualified withdrawals are generally tax-free.', 'If you expect a higher tax rate in retirement, Roth can be attractive; if you expect a lower rate, Traditional may be. Rules and limits change — confirm current details at irs.gov.'], quiz: { q: 'Qualified Roth IRA withdrawals are generally…', o: ['Tax-free', 'Taxed twice', 'Not allowed'], a: 0, why: 'You pay tax up front, so qualified withdrawals are generally tax-free.' } },
      { id: 'rmd', title: 'Required minimum distributions', mins: 4, body: ['Tax-deferred accounts such as Traditional IRAs require you to start withdrawing a minimum amount each year once you reach a certain age. The amount is your prior year-end balance divided by a life-expectancy factor.', 'Missing an RMD can trigger a penalty, so many investors set up automatic distributions. Try the Retirement Distributions page to estimate yours.'], quiz: { q: 'An RMD is calculated from…', o: ['Your age only', 'Prior year-end balance ÷ a factor', 'Your salary'], a: 1, why: 'The IRS publishes factors by age; you divide the prior December 31 balance by that factor.' } },
      { id: 'withdraw', title: 'Sustainable withdrawals', mins: 5, body: ['A common rule of thumb suggests withdrawing about 4% of your starting portfolio in the first year of retirement and adjusting for inflation after. It is a starting point, not a guarantee.', 'Flexibility helps: spending a little less after market declines can make savings last longer.'], quiz: { q: 'The “4% rule” is…', o: ['A guarantee', 'A rule of thumb', 'A tax rule'], a: 1, why: 'It is a planning guideline drawn from historical data and not a promise.' } },
      { id: 'sequence', title: 'Sequence-of-returns risk', mins: 4, body: ['Poor returns early in retirement hurt more than poor returns later, because you are withdrawing money while prices are low.', 'Holding some cash and bonds for near-term spending can reduce the need to sell stocks at a bad time.'], quiz: { q: 'Sequence risk is worst when losses come…', o: ['Just before you retire or early in retirement', 'Decades before retiring', 'Never'], a: 0, why: 'Early losses combined with withdrawals shrink the balance that later growth builds upon.' } }
    ]
  };

  SB.GLOSSARY = [
    ['Ask', 'The lowest price a seller will accept right now.'],
    ['Bid', 'The highest price a buyer will pay right now.'],
    ['Coupon', 'The yearly interest rate a bond pays on its face value.'],
    ['Dividend', 'A share of company profits paid to stockholders.'],
    ['Expense ratio', 'The yearly fee a fund charges, as a percent of assets.'],
    ['NAV', 'Net asset value — a fund’s price per share, calculated once daily.'],
    ['P/E ratio', 'Share price divided by yearly earnings per share.'],
    ['Yield to maturity', 'Estimated annual return if a bond is held until it matures.']
  ];

  SB.ADVISORS = [
    { id: 'ad1', name: 'Maya Okafor', role: 'Retirement income specialist', note: 'Helps people turn savings into steady retirement income.', slots: 'Weekdays 9–5 ET' },
    { id: 'ad2', name: 'Daniel Reyes', role: 'Young professional planning', note: 'Student loans, first investments and building an emergency fund.', slots: 'Evenings and Saturdays' },
    { id: 'ad3', name: 'Priya Nair', role: 'Tax-aware investing', note: 'Account placement, Roth conversions and charitable giving.', slots: 'Tue–Thu 10–6 ET' },
    { id: 'ad4', name: 'Samuel Lindqvist', role: 'Family and education planning', note: 'Custodial accounts and saving for a child’s future.', slots: 'Mon–Fri 8–4 ET' },
    { id: 'ad5', name: 'Hannah Cho', role: 'Portfolio construction', note: 'Asset allocation, rebalancing and risk management.', slots: 'Weekdays 11–7 ET' }
  ];

  SB.INSIGHTS = [
    { id: 'in1', title: 'Why a written plan beats a hot tip', mins: 4, body: ['Investors who write down their goals, time horizon and the mix of assets they intend to hold are less likely to react to every headline. A plan answers three questions before the market asks them: what you are saving for, how long you can wait, and how much of a decline you can tolerate.', 'Revisit the plan once or twice a year, or after a major life change, rather than after every market move.'] },
    { id: 'in2', title: 'Costs you can control', mins: 3, body: ['You cannot control the market, but you can control fees. A fund charging 0.03% a year keeps nearly all of its return for you, while one charging 1% can take a meaningful bite over decades.', 'Check expense ratios, avoid unnecessary trading and use tax-advantaged accounts when they suit your situation.'] },
    { id: 'in3', title: 'Building an emergency cushion first', mins: 3, body: ['Many planners suggest holding several months of essential expenses in cash before investing for long-term goals. A cushion keeps you from selling investments at a bad moment to cover a surprise bill.', 'Cash in a money market fund or insured deposit can earn interest while staying readily available.'] },
    { id: 'in4', title: 'Staying calm in volatile markets', mins: 4, body: ['Market declines are a normal part of investing. Having an appropriate mix of stocks and bonds, a cash reserve and a plan to rebalance can make downturns easier to live with.', 'Consider automating contributions: investing a fixed amount on a schedule means you buy more shares when prices are low and fewer when they are high.'] },
    { id: 'in5', title: 'Giving and investing together', mins: 4, body: ['Donating appreciated shares instead of cash can be tax-efficient for some donors. Because rules vary, speak with a qualified tax professional before acting.', 'Wealth planning is about aligning money with values: security for your family, flexibility for your career and support for the causes you care about.'] }
  ];
})();
