#!/usr/bin/env node
// make — validate → sfx → mix → render, skipping steps whose inputs are unchanged.
// Usage: npm run make -- <project> [--draft] [--aspect 16:9] [--workers N] [--force] [--no-audio]

import './lib/bins.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/pyenv.mjs';
import { audioFiles, findMusic } from './lib/audio-files.mjs';

const { values: f, positionals: [name] } = parseArgs({
  allowPositionals: true,
  options: {
    draft: { type: 'boolean' },
    aspect: { type: 'string' },
    workers: { type: 'string' },
    force: { type: 'boolean' },
    'no-audio': { type: 'boolean' },
  },
});

if (!name) {
  console.error('usage: npm run make -- <project>');
  process.exit(1);
}

const dir = path.join(ROOT, 'projects', name);
const build = path.join(dir, 'build');

fs.mkdirSync(build, { recursive: true });

const fail = (m) => {
  console.error('\n✖ ' + m);
  process.exit(1);
};

const mt = (p) => fs.statSync(p).mtimeMs;

const statePath = path.join(build, 'make.state.json');
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : {};

const tool = (t, a = []) =>
  spawnSync(
    process.execPath,
    [path.join(ROOT, 'tools', t), ...a],
    { stdio: 'inherit', cwd: ROOT }
  ).status === 0;

function walk(d, out = []) {
  if (!fs.existsSync(d)) return out;

  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    // M4 fix: skip ALL dot-directories (.build, .git, …) — capture writes segments to
    // .build/capture, and walking them busted the render cache on every run.
    if (
      e.name.startsWith('.') ||
      /^(node_modules|build|dist|qa)$/.test(e.name) ||
      /^out(\.draft)?\.mp4$/.test(e.name) ||
      e.name === 'narration.txt' ||
      e.name === 'registry.generated.js'
    ) {
      continue;
    }

    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }

  return out;
}

function sig(files, extra = '') {
  const h = crypto.createHash('sha1').update(extra);

  for (const x of files) {
    try {
      const s = fs.statSync(x);
      h.update(`${x}|${s.size}|${Math.round(s.mtimeMs)}`);
    } catch {
      h.update(x + '|?');
    }
  }

  return h.digest('hex');
}

function stage(key, label, inputs, outputs, run, extra = '') {
  const h = sig(inputs, extra);

  if (
    !f.force &&
    state[key] === h &&
    outputs.every((o) => fs.existsSync(o))
  ) {
    console.log(`↷ ${label} (unchanged)`);
    return;
  }

  console.log(`\n▶ ${label}`);

  const t = Date.now();

  if (!run()) fail(`${label} failed`);

  state[key] = h;
  fs.writeFileSync(statePath, JSON.stringify(state, null, 1));

  console.log(`  ${((Date.now() - t) / 1000).toFixed(1)}s`);
}

const T0 = Date.now();

const scriptF = path.join(dir, 'script.json');
const wordsF = path.join(dir, 'words.json');

const narr = path.join(build, 'narration.wav');
const sfxW = path.join(build, 'sfx.wav');
const finalW = path.join(build, 'final.wav');

// ── Validate ──────────────────────────────────────────────

console.log('▶ validate');

const validateArgs = [name];

if (f.draft) {
  validateArgs.push('--draft');
}

if (f.aspect) {
  validateArgs.push('--aspect', f.aspect);
}

if (!tool('validate.mjs', validateArgs)) {
  fail('validate failed — fix the script first');
}

// ── Audio ─────────────────────────────────────────────────

const files = audioFiles(dir);
const audio = !f['no-audio'] && files.length > 0;

if (audio) {
  if (!fs.existsSync(wordsF) || !fs.existsSync(narr)) {
    fail(`audio found but not aligned. Run: npm run align -- ${name}`);
  }

  // #12 fix: mtimes lie after a fresh clone or branch switch (git re-stamps files in
  // checkout order). Trust a content hash from the last successful run when we have one.
  const audioInputs = [
    ...files.map((x) => path.join(dir, 'audio', x)),
    wordsF,
  ];
  const audioSig = sig(audioInputs);

  if (state['audio'] === audioSig) {
    console.log('  ↷ audio unchanged since last make (content hash matches)');
  } else {
    const newest = Math.max(...files.map((x) => mt(path.join(dir, 'audio', x))));

    if (newest > mt(wordsF)) {
      fail(`audio is newer than words.json. Run: npm run align -- ${name}`);
    }

    state['audio'] = audioSig;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 1));
  }

  if (mt(scriptF) > mt(wordsF)) {
    console.log(
      '  ⚠ script.json changed after align — if narration text changed, re-run align'
    );
  }
} else {
  console.log('  ⚠ no narration audio — rendering silent with estimated timing');
}

// ── SFX and mix ───────────────────────────────────────────

const core = [
  ...walk(path.join(ROOT, 'core')),
  ...walk(path.join(ROOT, 'backends')),
];

if (audio) {
  stage(
    'sfx',
    'sfx',
    [
      scriptF,
      wordsF,
      ...core,
      ...['py/sfx.py', 'lib/events.mjs', 'sfx.mjs'].map((x) =>
        path.join(ROOT, 'tools', x)
      ),
    ],
    [sfxW],
    () => tool('sfx.mjs', [name])
  );

  const music = findMusic(dir, ROOT);

  stage(
    'mix',
    'mix',
    [
      narr,
      sfxW,
      ...(music ? [music] : []),
      ...['py/mix.py', 'mix.mjs'].map((x) =>
        path.join(ROOT, 'tools', x)
      ),
    ],
    [finalW],
    () => tool('mix.mjs', [name])
  );
}

// ── Render ────────────────────────────────────────────────

const outF = path.join(
  dir,
  f.draft ? 'out.draft.mp4' : 'out.mp4'
);

const inputs = [
  scriptF,
  ...(fs.existsSync(wordsF) ? [wordsF] : []),
  ...(audio ? [finalW] : []),
  ...core,
  ...walk(path.join(ROOT, 'props')),
  ...walk(dir),
  ...walk(path.join(ROOT, 'assets')),
  ...walk(path.join(ROOT, 'fonts')),
].filter((x) => !x.includes(`${path.sep}audio${path.sep}`));

const cap = [
  name,
  ...(f.draft ? ['--draft'] : []),
  ...(f.aspect ? ['--aspect', f.aspect] : []),
  ...(f.workers ? ['--workers', f.workers] : []),
  ...(audio ? ['--audio', finalW] : []),
];

stage(
  f.draft ? 'render-draft' : 'render',
  `render ${f.draft ? '(draft)' : ''}`,
  inputs,
  [outF],
  () => tool('capture.mjs', cap),
  `${f.aspect}|${f.workers}`
);

// ── Done ──────────────────────────────────────────────────

console.log(
  `\n✔ ${path.relative(ROOT, outF)}  ${(fs.statSync(outF).size / 1e6).toFixed(1)} MB  · total ${((Date.now() - T0) / 1000).toFixed(0)}s\n`
);
