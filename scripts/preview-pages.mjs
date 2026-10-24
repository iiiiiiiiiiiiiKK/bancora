import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist-pages');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (!url.startsWith('/bancora')) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    let rel = url.slice('/bancora'.length) || '/';
    if (rel.endsWith('/')) rel += 'index.html';
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(root, 'index.html')));
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(abs)] || 'application/octet-stream' });
    res.end(fs.readFileSync(abs));
  })
  .listen(4180, '127.0.0.1', () => console.log('pages preview http://127.0.0.1:4180/bancora/'));
