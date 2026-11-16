// tools/setup.mjs — one-time online setup: fonts + sample asset, then doctor. Everything after this runs offline.
// Usage: npm run setup
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib/env.mjs';
import { FONTS } from '../lib/fonts.mjs';

const ok = (m) => console.log(`✔ ${m}`), bad = (m) => console.log(`✖ ${m}`);
if (+process.versions.node.split('.')[0] < 20) { bad(`Node 20+ required (you have ${process.versions.node})`); process.exit(1); }
try { await import('skia-canvas'); } catch { bad('skia-canvas is not installed — run: npm install skia-canvas ffmpeg-static'); process.exit(1); }

const fontDir = path.join(ROOT, 'fonts');
fs.mkdirSync(fontDir, { recursive: true });
const MAGIC = ['\x00\x01\x00\x00', 'OTTO', 'true', 'wOFF'];
for (const f of FONTS) {
  const dest = path.join(fontDir, f.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) { ok(`${f.family} already present`); continue; }
  try {
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10000 || !MAGIC.includes(buf.subarray(0, 4).toString('latin1'))) throw new Error('not a font file');
    fs.writeFileSync(dest, buf);
    ok(`${f.family} downloaded (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) { bad(`${f.family}: ${e.message} — download a TTF manually and save it as fonts/${f.file}`); }
}

// Sample photo so props have something to show without any external asset.
const { createNodeBackend } = await import('../backends/node.js');
const be = await createNodeBackend({ lib: 'skia' });
const W = 1200, H = 800, c = be.createCanvas(W, H), x = c.getContext('2d');
let s = 1234567; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const sky = x.createLinearGradient(0, 0, 0, H * 0.7);
sky.addColorStop(0, '#2c4a7a'); sky.addColorStop(0.55, '#f2a65a'); sky.addColorStop(1, '#f8d9a0');
x.fillStyle = sky; x.fillRect(0, 0, W, H);
x.fillStyle = '#fff3c4'; x.beginPath(); x.arc(W * 0.7, H * 0.52, 90, 0, Math.PI * 2); x.fill();
x.fillStyle = '#3d5a80'; x.fillRect(0, H * 0.72, W, H * 0.28);
for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,236,190,${0.1 + rnd() * 0.25})`; x.fillRect(rnd() * W, H * 0.73 + rnd() * H * 0.25, 40 + rnd() * 160, 3); }
for (let bx = -20, i = 0; bx < W; i++) {
  const bw = 50 + rnd() * 90, bh = 120 + rnd() * 330;
  x.fillStyle = i % 3 ? '#16202e' : '#1d2b3e'; x.fillRect(bx, H * 0.72 - bh, bw, bh);
  for (let wy = H * 0.72 - bh + 14; wy < H * 0.72 - 14; wy += 22) for (let wx = bx + 8; wx < bx + bw - 10; wx += 16) if (rnd() > 0.55) { x.fillStyle = '#ffd84a'; x.fillRect(wx, wy, 7, 11); }
  bx += bw + 4 + rnd() * 10;
}
const dir = path.join(ROOT, 'assets', 'sample');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'skyline.png'), await be.png(c));
ok('sample asset assets/sample/skyline.png');

console.log('\nRunning doctor…\n');
process.exit(spawnSync(process.execPath, [path.join(ROOT, 'tools/doctor.mjs')], { stdio: 'inherit' }).status ?? 1);
