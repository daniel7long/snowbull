/* Copies the shared SnowBull files into the SnowBall+ site (one level up) so the embed always matches the standalone app.
 *   npm run sync   (run from snowbull/)  — then bump ?v= in ../index.html and redeploy SnowBall+ */
'use strict';
const fs = require('fs'), path = require('path');
const here = path.join(__dirname, '..'), site = path.join(here, '..');
const map = [
  ['public/core/knowledge.js', 'js/snowbull-kb.js'],
  ['public/core/snowbull-core.js', 'js/snowbull-core.js'],
  ['public/snowbull-ui.js', 'js/snowbull-ui.js'],
  ['public/snowbull.css', 'css/snowbull.css']
];
map.forEach(([a, b]) => { fs.copyFileSync(path.join(here, a), path.join(site, b)); console.log('synced', a, '->', b); });
