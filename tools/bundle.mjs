#!/usr/bin/env node
// bundle — fetch EVERYTHING once (fonts, geo, python wheels, whisper model) so the folder is self-contained.
// Usage: npm run bundle [-- --model small.en]
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib/pyenv.mjs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const extra = process.argv.slice(2);
const steps = [
  ['setup', []],
  ['setup:geo', []],
  ['setup:audio', ['--', '--download-wheels', ...extra]],
  ['doctor', []],
];
for (const [s, a] of steps) {
  console.log(`\n━━ npm run ${s} ━━`);
  const r = spawnSync(npm, ['run', s, ...a], { stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32' });
  if (r.status !== 0) { console.error(`\n✖ ${s} failed — fix and re-run: npm run bundle`); process.exit(1); }
}
console.log('\n✔ bundle complete. Package it with: npm run pack');
