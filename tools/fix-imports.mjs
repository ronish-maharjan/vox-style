// tools/fix-imports.mjs — rewrite deep relative imports in props to package imports. Safe to re-run.
// Usage: node tools/fix-imports.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/registry.mjs';

const PKG = 'vox-studio';
const files = [];
const walk = (d) => {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith('.js')) files.push(f);
  }
};
walk(path.join(ROOT, 'props'));
for (const p of fs.existsSync(path.join(ROOT, 'projects')) ? fs.readdirSync(path.join(ROOT, 'projects')) : [])
  walk(path.join(ROOT, 'projects', p, 'props'));

let changed = 0;
for (const f of files) {
  if (f.includes(`${path.sep}_shared${path.sep}`)) continue; // kit-internal, stays relative to core
  const src = fs.readFileSync(f, 'utf8');
  const out = src.replace(/(from\s+)(['"])((?:\.\.\/)+)(_shared|core)\/([\w./-]+\.js)\2/g, (_, a, q, _up, dir, rest) =>
    `${a}${q}${PKG}/${dir === 'core' ? 'core' : 'kit'}/${rest}${q}`);
  if (out !== src) { fs.writeFileSync(f, out); changed++; console.log(`fixed ${path.relative(ROOT, f)}`); }
}
console.log(`${changed} file(s) updated`);
