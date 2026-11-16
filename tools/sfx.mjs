#!/usr/bin/env node
// sfx — builds projects/<p>/build/sfx.wav from shot.sfx + automatic prop/transition sounds.
// Usage: npm run sfx -- <project> [--no-auto] [--dump]
import './lib/bins.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, runPy } from './lib/pyenv.mjs';
import { collectEvents } from './lib/events.mjs';
import { loadNodeProject, duration } from '../backends/node.js';

const { values: flags, positionals: [name] } = parseArgs({
  allowPositionals: true,
  options: { 'no-auto': { type: 'boolean' }, dump: { type: 'boolean' }, duration: { type: 'string' } },
});
if (!name) { console.error('usage: npm run sfx -- <project>'); process.exit(1); }
const dir = path.join(ROOT, 'projects', name), build = path.join(dir, 'build');
fs.mkdirSync(build, { recursive: true });

try {
  const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
  const wf = path.join(dir, 'words.json');
  const words = fs.existsSync(wf) ? JSON.parse(fs.readFileSync(wf, 'utf8')) : null;
  const proj = await loadNodeProject({ project: name, strict: false });
  const tl = proj.timeline;
  if (flags.dump) {
    const shots = tl?.shots ?? tl;
    console.log('timeline keys :', Object.keys(tl || {}));
    console.log('shot[0] keys  :', Object.keys(shots?.[0] || {}));
    console.log('layer[0] keys :', Object.keys(shots?.[0]?.layers?.[0] || {}));
    console.log('project keys  :', Object.keys(proj));
    process.exit(0);
  }
  const { events, notes } = collectEvents({ tl, script, words, auto: !flags['no-auto'] });
  notes.forEach((n) => console.log('  ⚠ ' + n));
  const dur = flags.duration ? +flags.duration : duration(proj);
  const ef = path.join(build, 'sfx.events.json');
  fs.writeFileSync(ef, JSON.stringify(events, null, 1));
  const code = runPy('sfx.py', ['--events', ef, '--duration', String(dur), '--out', path.join(build, 'sfx.wav')]);
  if (code) process.exit(code);
  const by = {};
  events.forEach((e) => { by[e.name] = (by[e.name] || 0) + 1; });
  console.log('  ' + (Object.entries(by).map(([k, v]) => `${k}×${v}`).join('  ') || 'no events'));
} catch (e) {
  console.error('✖ ' + e.message);
  process.exit(1);
}
