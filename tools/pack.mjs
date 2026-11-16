#!/usr/bin/env node
// pack — one archive with code + fonts + geo + model + wheels (+ node_modules). Same OS/arch to unpack.
// Usage: npm run pack [-- --no-node-modules]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/pyenv.mjs';
import { loadAlignConfig } from './lib/audio-config.mjs';

const { values: f } = parseArgs({ options: { 'no-node-modules': { type: 'boolean' } } });
const cfg = loadAlignConfig(ROOT);
const checks = [
  ['fonts/Anton-Regular.ttf', 'fonts'],
  ['props/maps/baseMap/geo-data.js', 'geo data (stub is tiny — run setup:geo)', 100_000],
  [`models/whisper/${cfg.model}/model.bin`, 'whisper model'],
  ['vendor/wheels', 'python wheels (offline install)'],
  ['node_modules', 'node_modules'],
];
let missing = 0;
for (const [p, label, min] of checks) {
  const full = path.join(ROOT, p);
  const ok = fs.existsSync(full) && (!min || fs.statSync(full).size > min);
  if (!ok) missing++;
  console.log(`  ${ok ? '✔' : '✖'} ${label}`);
}
if (missing) console.log('\n  ⚠ something is missing — run `npm run bundle` first for a fully offline package.\n');

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', `vox-studio-${process.platform}-${process.arch}.tar.gz`);
const ex = ['./dist', './.git', './vendor/venv', './projects/*/build', './projects/*/out.mp4', './projects/*/out.draft.mp4'];
if (f['no-node-modules']) ex.push('./node_modules');
const r = spawnSync('tar', ['-czf', out, ...ex.map((e) => `--exclude=${e}`), '-C', ROOT, '.'], { stdio: 'inherit' });
if (r.status !== 0) { console.error('✖ tar failed'); process.exit(1); }
console.log(`✔ ${path.relative(ROOT, out)}  ${(fs.statSync(out).size / 1e6).toFixed(0)} MB`);
console.log('  On the other machine: tar -xzf <file> && cd vox-studio && npm run setup:audio && npm run make -- <project>');
