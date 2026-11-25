'use strict';
const llm = require('./_lib/llm.js');
const core = require('../public/core/snowbull-core.js');
module.exports = function (req, res) {
  const o = process.env.SNOWBULL_ALLOW_ORIGIN;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', o && o !== '*' ? o.split(',')[0].trim() : '*');
  res.status(200).json({ ok: true, name: 'SnowBull', version: core.version, llm: llm.provider(), liveData: process.env.FINNHUB_KEY ? 'finnhub' : 'yahoo-fallback', docs: core._kb.docs.length });
};
