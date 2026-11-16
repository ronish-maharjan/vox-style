#!/usr/bin/env node
// mix — narration + sfx + music bed (ducked), normalised to -14 LUFS → build/final.wav
// Usage: npm run mix -- <project> [--no-music] [--music-db -17] [--duck-db 7]
// Music: projects/<p>/audio/music.mp3 (or .wav/.m4a/.ogg/.flac), else assets/music.*, else a generated bed.
import './lib/bins.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT, runPy } from './lib/pyenv.mjs';
import { findMusic } from './lib/audio-files.mjs';
import { loadNodeProject, duration } from '../backends/node.js';

const { values: flags, positionals: [name] } = parseArgs({
  allowPositionals: true,
  options: { 'no-music': { type: 'boolean' }, 'music-db': { type: 'string' }, 'duck-db': { type: 'string' }, duration: { type: 'string' }, seed: { type: 'string' } },
});
if (!name) { console.error('usage: npm run mix -- <project>'); process.exit(1); }
const dir = path.join(ROOT, 'projects', name), build = path.join(dir, 'build');
fs.mkdirSync(build, { recursive: true });
const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8' });

const proj = await loadNodeProject({ project: name, strict: false });
const dur = flags.duration ? +flags.duration : duration(proj);

const args = ['--duration', String(dur), '--out', path.join(build, 'mix.wav')];
const voice = path.join(build, 'narration.wav'), sfx = path.join(build, 'sfx.wav');
if (fs.existsSync(voice)) args.push('--voice', voice); else console.log('  ⚠ no build/narration.wav (run align) — mixing without voice');
if (fs.existsSync(sfx)) args.push('--sfx', sfx);
if (flags['no-music']) args.push('--no-music');
else {
  const m = findMusic(dir, ROOT);
  if (m) {
    const mw = path.join(build, 'music.wav');
    const r = ff(['-i', m, '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', mw]);
    if (r.status !== 0) { console.error('✖ could not decode ' + m + '\n' + r.stderr); process.exit(1); }
    args.push('--music', mw);
    console.log('  music: ' + path.relative(ROOT, m));
  } else console.log('  music: generated bed (drop music.mp3 in the audio folder to use your own)');
}
if (flags['music-db']) args.push('--music-db', flags['music-db']);
if (flags['duck-db']) args.push('--duck-db', flags['duck-db']);
if (flags.seed) args.push('--seed', flags.seed);
const code = runPy('mix.py', args);
if (code) process.exit(code);

// two-pass loudnorm → -14 LUFS, -1.5 dBTP
const mix = path.join(build, 'mix.wav'), out = path.join(build, 'final.wav');
const T = 'I=-14:TP=-1.5:LRA=11';
const p1 = ff(['-i', mix, '-af', `loudnorm=${T}:print_format=json`, '-f', 'null', '-']);
let m;
try { m = JSON.parse(p1.stderr.slice(p1.stderr.lastIndexOf('{'), p1.stderr.lastIndexOf('}') + 1)); } catch { m = null; }
if (!m || !Number.isFinite(+m.input_i)) {
  console.log('  ⚠ loudness measurement failed (silent mix?) — copying unnormalised');
  fs.copyFileSync(mix, out);
} else {
  const p2 = ff(['-i', mix, '-af', `loudnorm=${T}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`, '-ar', '44100', '-c:a', 'pcm_s16le', out]);
  if (p2.status !== 0) { console.error('✖ loudnorm failed\n' + p2.stderr); process.exit(1); }
  console.log(`  loudness: ${(+m.input_i).toFixed(1)} LUFS → -14 LUFS`);
}
console.log(`✔ ${path.relative(ROOT, out)}`);
