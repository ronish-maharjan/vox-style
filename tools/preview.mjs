// tools/preview.mjs — static server + scan. Usage: npm run preview -- demo [--port=5173] [--open]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { ROOT, scan } from './scan-props.mjs';

const args = process.argv.slice(2), project = args.find((a) => !a.startsWith('--')) || 'demo';
const port = Number((args.find((a) => a.startsWith('--port=')) || '--port=5173').split('=')[1]);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wav': 'audio/wav' };

await scan();
http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const rel = path.relative(ROOT, p); // #2 fix: startsWith(ROOT) also served sibling dirs sharing the prefix
  if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
}).listen(port, () => {
  const url = `http://localhost:${port}/preview/?project=${project}`;
  console.log(`Preview: ${url}`);
  if (args.includes('--open')) exec(`${process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open'} "${url}"`);
});
