// Puts a bundled ffmpeg/ffprobe (npm: ffmpeg-static, ffprobe-static) on PATH when the system has none.
// Usage: import './lib/bins.mjs' as the FIRST import of any tool that spawns ffmpeg.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sep = process.platform === 'win32' ? ';' : ':';
const has = (cmd) => { try { return spawnSync(cmd, ['-version'], { stdio: 'ignore' }).status === 0; } catch { return false; } };
const add = (dir) => { process.env.PATH = dir + sep + (process.env.PATH || ''); };
const req = createRequire(import.meta.url);

add(path.join(ROOT, 'vendor', 'bin')); // hand-dropped binaries win
for (const [cmd, pkg, pick] of [['ffmpeg', 'ffmpeg-static', (m) => m], ['ffprobe', 'ffprobe-static', (m) => m.path]]) {
  if (has(cmd)) continue;
  try { const p = pick(req(pkg)); if (p) add(path.dirname(p)); } catch { /* not installed */ }
}
