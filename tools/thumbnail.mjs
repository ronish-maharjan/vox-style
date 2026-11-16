#!/usr/bin/env node
// thumbnail — cover image for a rendered project: one sharp frame, title-safe.
// Usage: npm run thumbnail -- <project> [--at 2.5] [--full] [--title "TEXT"] [--out cover.jpg]
// Picks the frame at --at seconds (default: the settled middle of the first shot with
// content), adds an optional title overlay in the studio look, and writes a JPEG.
// Output: projects/<p>/thumbnail.jpg for upload.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/pyenv.mjs';
import { loadNodeProject } from '../backends/node.js';
import { FORMATS } from '../core/constants.js';

const { values: f, positionals: [name] } = parseArgs({
  allowPositionals: true,
  options: { at: { type: 'string' }, full: { type: 'boolean' }, title: { type: 'string' }, out: { type: 'string' }, 'title-color': { type: 'string' } },
});
if (!name) { console.error('usage: npm run thumbnail -- <project> [--at 2.5] [--full] [--title "TEXT"] [--out cover.jpg]'); process.exit(2); }

const dir = path.join(ROOT, 'projects', name);
const video = path.join(dir, f.full ? 'out.mp4' : (fs.existsSync(path.join(dir, 'out.mp4')) ? 'out.mp4' : 'out.draft.mp4'));
if (!fs.existsSync(video)) { console.error(`✖ no render found (run npm run video -- ${name} first)`); process.exit(1); }

const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });

// default time: middle of the first non-empty shot (settled content, not the entrance)
let at = f.at ? +f.at : null;
if (at === null || Number.isNaN(at)) {
  try {
    const proj = await loadNodeProject({ project: name, strict: false });
    const shot = proj.timeline.shots.find((s) => (s.layers || []).some((l) => !['solidBg', 'paperBg'].includes(l.prop)));
    const pick = shot || proj.timeline.shots[0];
    at = Math.min(pick.start + pick.duration * 0.6, proj.timeline.duration - 0.1);
  } catch { at = 1.0; }
}

const pr = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', video]).stdout || '{}');
const { width: w } = pr.streams[0] || {};
const fmt = Object.values(FORMATS).find((F) => F.W === w) || FORMATS['9:16'];

const out = f.out ? path.resolve(ROOT, f.out) : path.join(dir, 'thumbnail.jpg');

// base frame: grab at the chosen time at full source resolution
const tmp = path.join(dir, '.build', 'thumb-frame.png');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
let r = run('ffmpeg', ['-y', '-v', 'error', '-ss', at.toFixed(3), '-i', video, '-frames:v', '1', tmp]);
if (r.status !== 0 || !fs.existsSync(tmp)) { console.error('✖ frame grab failed: ' + r.stderr.split('\n')[0]); process.exit(1); }

// optional title overlay: display font band near the top of the safe area, paper-backed
let filters = [];
if (f.title) {
  const fontFile = path.join(ROOT, 'fonts', 'Anton-Regular.ttf');
  const fs_ = Math.round(fmt.W * 0.075);
  const x = Math.round(fmt.safe.left);
  const y = Math.round(fmt.safe.top + fmt.H * 0.06);
  const box = `box=1:boxcolor=0x1B1A17@0.78:boxborderw=${Math.round(fs_ * 0.35)}`;
  const color = f['title-color'] === 'paper' ? '0xF3EBDD' : '0xFFFFFF';
  filters.push(`drawtext=fontfile=${fontFile}:text='${String(f.title).replace(/[':\\]/g, '')}':x=${x}:y=${y}:fontsize=${fs_}:fontcolor=${color}:${box}`);
}

r = run('ffmpeg', ['-y', '-v', 'error', '-i', tmp, ...(filters.length ? ['-vf', filters.join(',')] : []), '-q:v', '2', out]);
fs.rmSync(tmp, { force: true });
if (r.status !== 0 || !fs.existsSync(out)) { console.error('✖ thumbnail encode failed: ' + r.stderr.split('\n')[0]); process.exit(1); }

console.log(`✔ ${path.relative(ROOT, out)}  (frame @ ${at.toFixed(1)}s${f.title ? `, title: "${f.title}"` : ''}, ${(fs.statSync(out).size / 1e3).toFixed(0)} kB)`);
