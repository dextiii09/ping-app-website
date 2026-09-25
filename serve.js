// Simple zero-dependency HTTP server for ES modules
const http = require('http');
const fs = require('fs');
const path = require('path');

// `node serve.js --prod --port=3001` mirrors production (Vercel): it also
// sends the security headers from vercel.json (so the Content-Security-Policy
// can be tested before deploying) and serves /privacy for privacy.html, like
// vercel.json's cleanUrls.
const argv = process.argv.slice(2);
const PROD = argv.includes('--prod');
const PORT = Number((argv.find(a => a.startsWith('--port=')) || '').split('=')[1]) || 3000;
const PROD_HEADERS = {};
if (PROD) {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8'));
  for (const rule of vercel.headers || []) for (const h of rule.headers) PROD_HEADERS[h.key] = h.value;
}
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.xml': 'application/xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, safePath);
  if (PROD && !path.extname(filePath) && fs.existsSync(filePath + '.html')) filePath += '.html';

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      ...(PROD ? PROD_HEADERS : { 'Access-Control-Allow-Origin': '*' })
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Ping Platform running at http://localhost:${PORT}${PROD ? ' (production headers)' : ''}`);
});
