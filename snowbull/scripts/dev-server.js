/* Zero-dependency local server: static files from public/ + /api/* handlers (what `vercel dev` does). */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'public'), port = +process.env.PORT || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (p.startsWith('/api/')) {
    const file = path.join(__dirname, '..', 'api', path.basename(p) + '.js');
    if (!/^\/api\/[a-z]+$/.test(p) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    let raw = ''; req.on('data', (d) => { raw += d; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = {}; }
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (b) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)); };
      Promise.resolve(require(file)(req, res)).catch((e) => { console.error(e); res.statusCode = 500; res.end('error'); });
    });
    return;
  }
  const f = path.normalize(path.join(root, p === '/' ? 'index.html' : p));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log('SnowBull on http://localhost:' + port));
