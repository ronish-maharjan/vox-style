#!/usr/bin/env node
// slots — prints a prop's slots/options/example straight from its meta (so scripts use the real names).
// Usage: npm run slots -- stamp barChart     |     npm run slots -- --all
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib/pyenv.mjs';

function* propDirs(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('_')) continue;
    const p = path.join(d, e.name);
    if (fs.existsSync(path.join(p, 'index.js'))) yield p; else yield* propDirs(p);
  }
}
const roots = [path.join(ROOT, 'props')];
const pj = path.join(ROOT, 'projects');
if (fs.existsSync(pj)) for (const p of fs.readdirSync(pj)) roots.push(path.join(pj, p, 'props'));

const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const all = process.argv.includes('--all');
if (!want.length && !all) { console.error('usage: npm run slots -- <prop> [<prop>…]   |   --all'); process.exit(1); }

for (const r of roots) for (const dir of propDirs(r)) {
  const n = path.basename(dir);
  if (!all && !want.includes(n)) continue;
  try {
    const { meta } = (await import(pathToFileURL(path.join(dir, 'index.js')).href)).default;
    console.log(`\n── ${meta.name}  (${path.relative(ROOT, dir)})  default ${meta.defaultDuration}s${meta.enter ? `, enter ${meta.enter}s` : ''}`);
    console.log('slots   ', JSON.stringify(meta.slots));
    console.log('options ', JSON.stringify(meta.options));
    console.log('example ', JSON.stringify(meta.example));
  } catch (e) { console.log(`\n── ${n}: failed to import — ${e.message}`); }
}
