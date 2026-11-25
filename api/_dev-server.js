// Local test server, no Vercel login needed:   node api/_dev-server.js
// Then open http://localhost:3001/api/forecast?point=kabul_nowshera&demo=1
// (On Vercel this file is ignored because its name starts with "_".)
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3001;

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const name = url.pathname.replace(/^\/api\//, '').replace(/[^a-z_-]/gi, '');
  const file = path.join(__dirname, `${name}.js`);
  if (!url.pathname.startsWith('/api/') || name.startsWith('_') || !fs.existsSync(file)) {
    res.statusCode = 404;
    return res.end('Not found. Try /api/forecast, /api/replay, /api/house');
  }
  req.query = Object.fromEntries(url.searchParams);
  require(file)(req, res);
}).listen(PORT, () => console.log(`Sailaab API on http://localhost:${PORT}/api/forecast?demo=1`));
