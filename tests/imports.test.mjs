// tests/imports.test.mjs — props must not reach outside their own folder with relative imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/registry.mjs';

const files = [];
const walk = (d) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const f = path.join(d, e.name); e.isDirectory() ? walk(f) : e.name.endsWith('.js') && files.push(f); } };
walk(path.join(ROOT, 'props'));
if (fs.existsSync(path.join(ROOT, 'projects'))) for (const p of fs.readdirSync(path.join(ROOT, 'projects'))) walk(path.join(ROOT, 'projects', p, 'props'));

test('props import the studio via vox-studio/..., not ../', () => {
  const bad = [];
  for (const f of files) {
    if (f.includes(`${path.sep}_shared${path.sep}`) || f.includes('registry.generated')) continue;
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/from\s+['"](\.\.\/[^'"]*)['"]/g)) bad.push(`${path.relative(ROOT, f)}: ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});
