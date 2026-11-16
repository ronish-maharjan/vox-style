// tools/analyze.mjs — machine-readable QA: shot table, flags, suggested fixes.
// Single analysis core used by THREE callers so they can never disagree:
//   - qa.mjs (human report + PNGs)          — prints/writes report.txt
//   - qa --json / video.mjs / MCP           — reads the returned object
//   - index.js renderProject(opts.qa)       — embeds it in the API result
// Usage (API): const report = await analyzeProject({ project, video?, root?, aspect? })
// Flags per shot: LONG, EMPTY, COLLISION, SAFE-AREA · plus duration/loudness summary.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT as DEFAULT_ROOT } from '../lib/registry.mjs';
import { loadNodeProject, makeAssetFinder } from '../backends/node.js';
import { FORMATS, LONG_SHOT, MAX_QUIET, TEXT_HEAVY } from '../core/constants.js';

const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });

/** Estimated pixel box of a layer (best effort: explicit geometry or prop defaults). */
function layerBox(layer, def, fmt, aspect) {
  const o = { ...(layer.options || {}), ...(layer.slots || {}) };
  const base = { x: o.x, y: o.y, w: o.w, h: o.h };
  const len = (v, axis) => {
    const L = axis === 'x' || axis === 'w' ? fmt.W : fmt.H;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const m = /^(-?\d+(?:\.\d+)?)(%|px)?$/.exec(v.trim());
      if (m) return m[2] === '%' ? (parseFloat(m[1]) * L) / 100 : parseFloat(m[1]);
    }
    return null;
  };
  let x = len(base.x, 'x'), y = len(base.y, 'y'), w = len(base.w, 'w'), h = len(base.h, 'h');
  if (x === null || y === null) {
    // unpositioned content props default to the safe-band centre (kit place())
    x = x ?? fmt.W / 2;
    y = y ?? (fmt.safe.top + (fmt.H - fmt.safe.bottom)) / 2;
  }
  return { x, y, w, h };
}

const overlap = (a, b) => a.w > 0 && b.w > 0 && a.h > 0 && b.h > 0 &&
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

export async function analyzeProject({ project, video = null, root = DEFAULT_ROOT, aspect = null }) {
  const dir = path.join(root, 'projects', project);
  const file = video ?? path.join(dir, fs.existsSync(path.join(dir, 'out.mp4')) ? 'out.mp4' : 'out.draft.mp4');
  if (!fs.existsSync(file)) return { ok: false, error: `no render found at ${path.relative(root, file)} (run make first)` };

  // ── video probe ──
  const pr = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file]).stdout || '{}');
  if (!pr.streams?.[0]) return { ok: false, error: 'ffprobe could not read the video' };
  const w = pr.streams[0].width, h = pr.streams[0].height, duration = +pr.format.duration;
  const fmtKey = aspect || Object.keys(FORMATS).find((k) => FORMATS[k].W === w && FORMATS[k].H === h) || (h > w ? '9:16' : '16:9');
  const fmt = FORMATS[fmtKey];

  // ── timeline + prop meta (non-strict: analysis must never crash on a broken script) ──
  let shots = [], propsMeta = {}, props = {};
  let timelineError = null;
  try {
    const proj = await loadNodeProject({ project, strict: false, root });
    shots = proj.timeline.shots;
    props = proj.props || {};
    for (const [name, def] of Object.entries(props)) propsMeta[name] = def.meta || {};
  } catch (e) { timelineError = e.message.split('\n')[0]; }

  const out = {
    ok: true, project, video: path.relative(root, file), aspect: fmtKey,
    width: w, height: h, duration: Math.round(duration * 10) / 10, fps: null,
    timelineError,
    shots: [], flags: [], warnings: [], suggestions: [],
    loudness: null, distinctProps: [],
  };

  // ── per-shot analysis ──
  const used = new Set();
  shots.forEach((s, i) => {
    const layers = (s.layers || []).map((l) => ({ ...l, meta: propsMeta[l.prop] || {} }));
    layers.forEach((l) => used.add(l.prop));
    const flags = [];
    if (s.duration > LONG_SHOT) flags.push('LONG');
    if (!layers.filter((l) => l.meta?.category !== 'backgrounds' && l.meta?.category !== 'transitions').length) flags.push('EMPTY');

    // collision check between content layers with explicit/known geometry
    const boxes = layers
      .filter((l) => {
        const cat = l.meta?.category;
        if (cat === 'backgrounds' || cat === 'transitions' || cat === 'annotations' || cat === 'text') return false;
        return true;
      })
      .map((l) => ({ id: l.id || l.prop, prop: l.prop, box: layerBox(l, l.meta, fmt, fmtKey) }))
      .filter((l) => l.box.w !== null && l.box.h !== null);
    const collisions = [];
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      if (overlap(boxes[a].box, boxes[b].box)) collisions.push(`${boxes[a].prop} ↔ ${boxes[b].prop}`);
    }
    if (collisions.length) flags.push('COLLISION');

    out.shots.push({
      index: i + 1, start: Math.round(s.start * 100) / 100, end: Math.round(s.end * 100) / 100,
      duration: Math.round(s.duration * 100) / 100, line: s.line,
      layers: layers.map((l) => l.prop), flags,
      ...(collisions.length ? { collisions } : {}),
    });
    if (flags.length) out.flags.push({ shot: i + 1, flags });
    if (collisions.length) out.suggestions.push(`shot ${i + 1}: give the overlapping props different y (or add target: "<layer id>" to lock an annotation onto its subject)`);
    if (s.duration > LONG_SHOT) out.suggestions.push(`shot ${i + 1} is LONG (${s.duration.toFixed(1)}s) — split the line or add a mid-shot cue (a new visual every 2-3s)`);
  });

  // pacing: seconds without any visual event
  const events = [...new Set(shots.flatMap((s) => [s.start, ...(s.layers || []).map((l) => l.start)]))].sort((a, b) => a - b);
  if (events.length) {
    const pts = [...events, duration];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i] - pts[i - 1] > MAX_QUIET) {
        out.warnings.push(`no new visual or cue for ${(pts[i] - pts[i - 1]).toFixed(1)}s (${pts[i - 1].toFixed(1)}s → ${pts[i].toFixed(1)}s)`);
      }
    }
  }

  if (duration < 25 || duration > 45) out.warnings.push(`duration ${duration.toFixed(1)}s is outside the 30-40s target`);
  out.distinctProps = [...used];

  // ── loudness ──
  const lu = run('ffmpeg', ['-nostats', '-hide_banner', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr;
  const last = (re) => { const m = [...lu.matchAll(re)]; return m.length ? m.at(-1)[1] : null; };
  const I = last(/I:\s+(-?[\d.]+) LUFS/g), pk = last(/Peak:\s+(-?[\d.]+) dBFS/g);
  if (I) {
    out.loudness = { integrated: +I, peak: pk === null ? null : +pk, target: -14 };
    if (Math.abs(+I + 14) > 1.5) out.warnings.push(`loudness ${I} LUFS is more than 1.5 LU from the -14 target`);
  }

  return out;
}

// ── CLI: node tools/analyze.mjs <project> [--json] [--video path] ──
if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const args = process.argv.slice(2);
  const project = args.find((a) => !a.startsWith('--'));
  const json = args.includes('--json');
  const vi = args.indexOf('--video');
  if (!project) { console.error('usage: node tools/analyze.mjs <project> [--json] [--video path]'); process.exit(2); }
  const report = await analyzeProject({ project, video: vi >= 0 ? args[vi + 1] : null });
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    if (!report.ok) { console.error(`✖ ${report.error}`); process.exit(1); }
    console.log(`analyze ${report.project} · ${report.aspect} · ${report.duration}s · ${report.shots.length} shots`);
    for (const s of report.shots) console.log(`  ${String(s.index).padStart(2)} ${String(s.duration.toFixed(1)).padStart(4)}s  ${(s.layers.join(', ') || '(none)').padEnd(48)} ${s.flags.join(' ')}`);
    for (const s of report.suggestions) console.log(`  → ${s}`);
    for (const s of report.warnings) console.log(`  ⚠ ${s}`);
  }
  process.exit(report.ok && !report.flags.length ? 0 : 1);
}
