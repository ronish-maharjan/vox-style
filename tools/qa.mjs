#!/usr/bin/env node
// qa — contact sheets + shot frames (with safe-area box) + pacing/loudness report for a rendered project.
// Usage: npm run qa -- <project> [--every 0.5] [--full] [--no-overlay] [--cols N] [--json]
// Reads out.draft.mp4 (or out.mp4 with --full); renders a draft first if missing. Output: projects/<p>/qa/
// --json prints the machine-readable analyze report (same core as video/MCP) and skips PNGs.
import './lib/bins.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/pyenv.mjs';
import { shotsOf } from './lib/events.mjs';
import { loadNodeProject } from '../backends/node.js';
import { FORMATS, LONG_SHOT } from '../core/constants.js';

const { values: f, positionals: [name] } = parseArgs({
  allowPositionals: true,
  options: { every: { type: 'string' }, full: { type: 'boolean' }, 'no-overlay': { type: 'boolean' }, cols: { type: 'string' }, json: { type: 'boolean' } },
});
if (!name) { console.error('usage: npm run qa -- <project> [--every 0.5] [--full] [--json]'); process.exit(1); }
const dir = path.join(ROOT, 'projects', name), qa = path.join(dir, 'qa');
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
const every = f.every ? +f.every : 0.5;

// --json: the machine-readable report (shared analyze core; no PNGs)
if (f.json) {
  const video = path.join(dir, f.full ? 'out.mp4' : 'out.draft.mp4');
  if (!fs.existsSync(video)) {
    const mk = spawnSync(process.execPath, [path.join(ROOT, 'tools/make.mjs'), name, ...(f.full ? [] : ['--draft'])], { stdio: 'inherit', cwd: ROOT });
    if (mk.status !== 0 || !fs.existsSync(video)) { console.error('✖ render failed'); process.exit(1); }
  }
  const { analyzeProject } = await import('./analyze.mjs');
  const report = await analyzeProject({ project: name, video, root: ROOT });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok && !report.flags.length ? 0 : 1);
}

let video = path.join(dir, f.full ? 'out.mp4' : 'out.draft.mp4');
if (!fs.existsSync(video)) {
  console.log('No render yet — making one first …');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'make.mjs'), name, ...(f.full ? [] : ['--draft'])], { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0 || !fs.existsSync(video)) { console.error('✖ render failed'); process.exit(1); }
}
fs.rmSync(qa, { recursive: true, force: true });
fs.mkdirSync(path.join(qa, 'shots'), { recursive: true });

// ── probe ──
const pr = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', video]).stdout || '{}');
if (!pr.streams?.[0]) { console.error('✖ ffprobe could not read ' + video); process.exit(1); }
const { width: w, height: h } = pr.streams[0];
const dur = +pr.format.duration;
const portrait = h > w;
// Format geometry comes from core/constants.js (single source of truth, shared with theme/validate).
// Pick the format whose W x H matches the rendered file (falls back by ratio for odd sizes).
const fmtKey = Object.keys(FORMATS).find((k) => FORMATS[k].W === w && FORMATS[k].H === h)
  ?? (h > w ? '9:16' : '16:9');
const F = FORMATS[fmtKey];
const L = { W: F.W, H: F.H, t: F.safe.top, b: F.safe.bottom, l: F.safe.left, r: F.safe.right };
const k = w / L.W;
const overlay = f['no-overlay'] ? [] : [`drawbox=x=${Math.round(L.l * k)}:y=${Math.round(L.t * k)}:w=${Math.round((L.W - L.l - L.r) * k)}:h=${Math.round((L.H - L.t - L.b) * k)}:color=red@0.9:t=3`];

// ── contact sheets ──
const cols = f.cols ? +f.cols : portrait ? 6 : 4, rows = portrait ? 4 : 5, per = cols * rows;
const tw = portrait ? 300 : 440;
const n = Math.floor(dur / every) + 1;
const fontDir = path.join(ROOT, 'fonts');
const font = fs.existsSync(fontDir) ? fs.readdirSync(fontDir).find((x) => /^Inter.*\.ttf$/i.test(x)) : null;
const label = font ? [`drawtext=fontfile=${path.join(fontDir, font)}:text=%{pts\\:flt}:x=5:y=5:fontsize=${portrait ? 22 : 20}:fontcolor=white:box=1:boxcolor=black@0.65`] : [];
const sheet = (lab) => run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-an', '-vf',
  [`fps=${1 / every}`, ...overlay, `scale=${tw}:-2`, ...lab, `tile=${cols}x${rows}:padding=4:margin=4:color=black`].join(','),
  path.join(qa, 'sheet_%02d.png')]);
let r = sheet(label);
if (r.status !== 0 && label.length) { console.log('  (timestamp labels unavailable in this ffmpeg — using the index list in report.txt)'); r = sheet([]); }
if (r.status !== 0) console.log('  ⚠ contact sheet failed: ' + r.stderr.split('\n')[0]);

// ── shot frames + pacing ──
const out = [];
const P = (s = '') => { out.push(s); console.log(s); };
let shots = [];
try { shots = shotsOf((await loadNodeProject({ project: name, strict: false })).timeline); } catch (e) { P(`⚠ timeline unreadable (${e.message.split('\n')[0]}) — no per-shot frames`); }
const grab = (t, file) => run('ffmpeg', ['-y', '-v', 'error', '-ss', t.toFixed(3), '-i', video, '-an', '-frames:v', '1', '-vf', [...overlay, `scale=${portrait ? 540 : 960}:-2`].join(','), file]);

P(`QA · ${name} · ${path.basename(video)} · ${w}x${h} · ${dur.toFixed(1)}s`);
P('');
P('shot  start   end   len  layers');
const num = (...v) => v.find((x) => typeof x === 'number');
shots.forEach((s, i) => {
  const a = num(s.start, s.t0, s.from) ?? 0, b = num(s.end, s.t1, s.to) ?? a;
  const id = String(i + 1).padStart(2, '0');
  grab(Math.min(a + 0.15, dur - 0.05), path.join(qa, 'shots', `shot-${id}a.png`));
  grab(Math.max(a, Math.min(b - 0.15, dur - 0.05)), path.join(qa, 'shots', `shot-${id}b.png`));
  const layers = (s.layers ?? []).map((l) => l.prop ?? l.name).join(', ') || '(none)';
  const flags = [b - a > LONG_SHOT ? 'LONG' : '', !(s.layers ?? []).length ? 'EMPTY' : ''].filter(Boolean).join(' ');
  P(`${id}   ${a.toFixed(1).padStart(5)} ${b.toFixed(1).padStart(5)} ${(b - a).toFixed(1).padStart(5)}  ${layers}  ${flags}`);
});
P('');
if (dur < 25 || dur > 45) P(`⚠ duration ${dur.toFixed(1)}s is outside the 30–40 s target`);
const used = new Set(shots.flatMap((s) => (s.layers ?? []).map((l) => l.prop ?? l.name)));
if (shots.length) P(`distinct props used: ${used.size} (${[...used].join(', ')})`);

// ── loudness ──
const lu = run('ffmpeg', ['-nostats', '-hide_banner', '-i', video, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr;
const last = (re) => { const m = [...lu.matchAll(re)]; return m.length ? m.at(-1)[1] : null; };
const I = last(/I:\s+(-?[\d.]+) LUFS/g), pk = last(/Peak:\s+(-?[\d.]+) dBFS/g);
P(I ? `loudness: ${I} LUFS (target -14), true peak ${pk} dBFS` : 'loudness: no audio track');
if (I && Math.abs(+I + 14) > 1.5) P('⚠ loudness is more than 1.5 LU from -14');

// ── index of sheets ──
P('');
for (let s = 0; s * per < n; s++) {
  const a = s * per, b = Math.min(n, a + per) - 1;
  P(`sheet_${String(s + 1).padStart(2, '0')}.png  t = ${(a * every).toFixed(1)} … ${(b * every).toFixed(1)}s  (row-major, ${cols} per row, red box = safe area)`);
}
fs.writeFileSync(path.join(qa, 'report.txt'), out.join('\n') + '\n');
P(`\n✔ ${path.relative(ROOT, qa)}/  — open the sheets, then shots/shot-NNa (entrance) and NNb (settled)`);
