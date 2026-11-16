#!/usr/bin/env node
// watch — re-validate + re-draft on every save of a project's script.json/intent.json.
// The fast human/agent iteration loop: edit -> save -> see the new draft + verdict.
// Usage: npm run watch -- <project> [--no-render] [--aspect 16:9]
//   --no-render  validate only (no draft re-render; useful on slow machines)
// Ctrl-C exits. Uses fs.watch (no dependencies).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/pyenv.mjs';

const { values: f, positionals: [name] } = parseArgs({
  allowPositionals: true,
  options: { 'no-render': { type: 'boolean' }, aspect: { type: 'string' } },
});
if (!name) { console.error('usage: npm run watch -- <project> [--no-render] [--aspect 16:9]'); process.exit(2); }

const dir = path.join(ROOT, 'projects', name);
if (!fs.existsSync(path.join(dir, 'script.json')) && !fs.existsSync(path.join(dir, 'intent.json'))) {
  console.error(`✖ projects/${name}/ has neither script.json nor intent.json`); process.exit(1);
}

const run = (file, args) => spawnSync(process.execPath, [path.join(ROOT, 'tools', file), ...args], { stdio: 'inherit', cwd: ROOT }).status === 0;
const stamp = () => new Date().toLocaleTimeString();

let running = false, queued = false;
function rebuild(why) {
  if (running) { queued = true; return; }
  running = true;
  console.log(`\n[${stamp()}] ${why}`);
  const t0 = Date.now();
  try {
    if (fs.existsSync(path.join(dir, 'intent.json')) && why.includes('intent')) run('compile.mjs', [name]);
    const okV = run('validate.mjs', [name, '--draft', ...(f.aspect ? ['--aspect', f.aspect] : [])]);
    if (okV && !f['no-render']) run('make.mjs', [name, '--draft', ...(f.aspect ? ['--aspect', f.aspect] : [])]);
    console.log(`[${stamp()}] ${okV ? '✔ ok' : '✖ fix the errors above'}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } finally {
    running = false;
    if (queued) { queued = false; rebuild('queued change'); }
  }
}

console.log(`watching projects/${name}/ (script.json, intent.json, words.json, assets/) — save to rebuild, Ctrl-C to stop`);
rebuild('initial build');
let timer = null;
const debounced = (why) => () => {
  clearTimeout(timer);
  timer = setTimeout(() => rebuild(why), 150);
};
try {
  fs.watch(dir, { recursive: true }, (event, file) => {
    if (!file) return;
    const why = file.includes('intent') ? 'intent.json changed'
      : file.includes('words') ? 'words.json changed'
      : file.includes('script') ? 'script.json changed'
      : `${file} changed`;
    debounced(why)();
  });
} catch (e) {
  console.error(`✖ fs.watch failed (${e.message}); poll instead?`); process.exit(1);
}
