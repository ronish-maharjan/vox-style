#!/usr/bin/env node
// subtitles — export SRT/VTT subtitles from a project's words.json (or caption chunks).
// Usage: npm run subtitles -- <project> [--vtt] [--out file.srt] [--chunked]
//   default: one subtitle per CAPTION CHUNK (what viewers see on screen)
//   --chunked is the default; word-level timing comes from words.json when present,
//   otherwise estimated from the script text (clearly marked).
// Output: projects/<p>/subtitles.srt (or .vtt), UTF-8.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib/pyenv.mjs';
import { buildChunks } from '../core/captions.js';
import { estimateWords } from '../core/words.js';
import { loadNodeProject } from '../backends/node.js';

const { values: f, positionals: [name] } = parseArgs({
  allowPositionals: true,
  options: { vtt: { type: 'boolean' }, out: { type: 'string' } },
});
if (!name) { console.error('usage: npm run subtitles -- <project> [--vtt] [--out file]'); process.exit(2); }

const dir = path.join(ROOT, 'projects', name);
if (!fs.existsSync(path.join(dir, 'script.json'))) {
  console.error(`✖ projects/${name}/script.json not found`); process.exit(1);
}

// words.json when it exists (real timings); else estimate from the script
const wordsFile = path.join(dir, 'words.json');
const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
const words = fs.existsSync(wordsFile)
  ? JSON.parse(fs.readFileSync(wordsFile, 'utf8'))
  : estimateWords(script.lines);

let chunks;
try {
  // build chunks exactly as the renderer does (captions.js is the single source of truth)
  const lines = words.lines.map((L) => {
    const sl = script.lines.find((x) => x.id === L.id) || {};
    return { id: L.id, text: sl.text ?? '', caps: sl.caps, words: (L.words || []).map((w) => ({ w: w.w, n: w.n, start: w.start, end: w.end })) };
  }).filter((L) => L.words.length);
  chunks = buildChunks(lines);
} catch (e) { console.error(`✖ could not build subtitle chunks: ${e.message}`); process.exit(1); }

const stamp = (t, vtt) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const x = String(ms % 1000).padStart(3, '0');
  return vtt ? `${h}:${m}:${s}.${x}` : `${h}:${m}:${s},${x}`;
};

const vtt = f.vtt === true;
const out = f.out
  ? path.resolve(ROOT, f.out)
  : path.join(dir, vtt ? 'subtitles.vtt' : 'subtitles.srt');

const parts = [];
if (vtt) parts.push('WEBVTT', '');
chunks.forEach((c, i) => {
  const text = c.tokens.map((t) => t.text).join(' ');
  if (!text.trim()) return;
  if (vtt) parts.push(`${stamp(c.start, true)} --> ${stamp(Math.max(c.end, c.start + 0.4), true)}`, text, '');
  else parts.push(String(i + 1), `${stamp(c.start)} --> ${stamp(Math.max(c.end, c.start + 0.4))}`, text, '');
});

fs.writeFileSync(out, parts.join('\n'));
console.log(`✔ ${path.relative(ROOT, out)}  (${chunks.length} cue(s), ${fs.existsSync(wordsFile) ? 'word-timed' : 'estimated timing'})`);

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) { /* CLI already ran above */ }
