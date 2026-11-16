// tools/capture.mjs — render a project to MP4 using parallel worker processes + ffmpeg.
// Usage: npm run capture -- <project> [--aspect 9:16|16:9] [--fps 30] [--draft] [--workers N]
//        [--lib skia|napi] [--seconds N] [--audio file.wav] [--out file.mp4]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, findFfmpeg, readConfig } from './lib/env.mjs';
import { loadNodeProject, duration } from '../backends/node.js';

const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const project = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--draft'].includes(argv[i - 1])));
const draft = argv.includes('--draft');
const aspectArg = get('aspect', null); // null = honour script.meta.aspect (C2 fix)
const cfg = readConfig();
const lib = get('lib', cfg.backend && cfg.backend !== 'browser' ? cfg.backend : 'skia');
const fps = +get('fps', draft ? '15' : '30');
// --workers with no value must fall back to the default, not NaN -> 0 workers (#9 fix)
const defaultWorkers = String(cfg.workers ?? Math.max(1, Math.min(6, Math.floor(os.cpus().length / 2))));
const workers = Math.max(1, +get('workers', defaultWorkers) || +defaultWorkers);
const audio = get('audio', null);
const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!project) throw new Error('usage: npm run capture -- <project> [--draft] [--aspect 16:9] ...');
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new Error('ffmpeg not found — run npm install, then npm run doctor');
  const proj = await loadNodeProject({ project, ...(aspectArg ? { aspect: aspectArg } : {}), lib, strict: true });
  const aspect = proj.aspect; // resolved: --aspect flag > script.meta.aspect > 9:16
  const dur = Math.min(duration(proj), +get('seconds', '1e9'));
  const total = Math.ceil(dur * fps);
  const out = path.resolve(get('out', path.join(ROOT, 'projects', project, draft ? 'out.draft.mp4' : 'out.mp4')));
  const dir = path.join(ROOT, 'projects', project, '.build', 'capture');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const n = Math.max(1, Math.min(workers, total));
  const chunk = Math.ceil(total / n);
  const ranges = Array.from({ length: n }, (_, k) => [k * chunk, Math.min(total, (k + 1) * chunk)]).filter(([a, b]) => b > a);
  console.log(`capture ${project} ${aspect} ${draft ? 'DRAFT ' : ''}${dur.toFixed(1)}s = ${total} frames @ ${fps}fps, ${ranges.length} worker(s), ${proj.be.name}`);

  const done = new Array(ranges.length).fill(0), kids = [], t0 = Date.now();
  const report = () => {
    const s = done.reduce((a, b) => a + b, 0), el = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  ${s}/${total} frames  ${(s / Math.max(el, 0.001)).toFixed(1)} fps   `);
  };
  const jobs = ranges.map(([a, b], k) => new Promise((res, rej) => {
    const p = spawn(process.execPath, [path.join(here, 'render-range.mjs'), '--project', project, '--aspect', aspect, '--fps', String(fps),
      '--from', String(a), '--to', String(b), '--out', path.join(dir, `seg${String(k).padStart(3, '0')}.mp4`), '--lib', lib, ...(draft ? ['--draft'] : [])],
    { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.stdout.on('data', (d) => { for (const l of String(d).split('\n')) if (l.startsWith('P ')) { done[k] = +l.slice(2); report(); } });
    p.on('close', (c) => (c === 0 ? res() : rej(new Error(`worker ${k} failed (exit ${c})\n${err.slice(-1500)}`))));
    kids.push(p);
  }));
  try { await Promise.all(jobs); } catch (e) { kids.forEach((p) => p.kill()); throw e; }
  process.stdout.write('\n');

  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, ranges.map((_, k) => `file '${path.join(dir, `seg${String(k).padStart(3, '0')}.mp4`).replace(/\\/g, '/')}'`).join('\n'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const mux = audio
    ? ['-f', 'concat', '-safe', '0', '-i', list, '-i', path.resolve(audio), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest']
    : ['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy'];
  const r = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...mux, '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`final mux failed: ${r.stderr}`);
  const el = (Date.now() - t0) / 1000;
  console.log(`✔ ${path.relative(ROOT, out)}  ${(fs.statSync(out).size / 1e6).toFixed(1)} MB  in ${el.toFixed(1)}s (${(total / el).toFixed(1)} fps overall)`);
}
main().catch((e) => { console.error(`\n✖ ${e.message}`); process.exit(1); });
