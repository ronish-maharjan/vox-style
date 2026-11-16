// tools/doctor.mjs — check that everything the pipeline needs is installed.
// Usage: npm run doctor   (exit 1 only on ✖; ⚠ are things needed in later phases or optional)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, findFfmpeg, hasEncoder, findChrome, findPython, pyHas } from './lib/env.mjs';
import { FONTS } from '../lib/fonts.mjs';

let fail = 0;
const line = (icon, name, msg = '') => console.log(`${icon} ${name.padEnd(22)} ${msg}`);
const good = (n, m) => line('✔', n, m), warn = (n, m) => line('⚠', n, m), err = (n, m) => { fail++; line('✖', n, m); };

+process.versions.node.split('.')[0] >= 20 ? good('node', process.versions.node) : err('node', `${process.versions.node} (need 20+)`);

const ff = findFfmpeg();
if (!ff) err('ffmpeg', 'not found — npm install ffmpeg-static (or install ffmpeg / set FFMPEG_PATH)');
else hasEncoder(ff, 'libx264') ? good('ffmpeg', `${ff} (libx264 ok)`) : err('ffmpeg', `${ff} has no libx264 encoder`);

let backend = null;
try { const m = await import('../backends/node.js'); backend = await m.createNodeBackend({ lib: 'skia' }); good('skia-canvas', `raw pixels via ${backend.rawName}`); }
catch (e) { err('skia-canvas', `${e.message.split('\n')[0]} — npm install skia-canvas`); }
try { await import('@napi-rs/canvas'); good('@napi-rs/canvas', 'installed (benchmark alternative)'); } catch { warn('@napi-rs/canvas', 'optional; only for npm run bench'); }

for (const f of FONTS) {
  if (!fs.existsSync(path.join(ROOT, 'fonts', f.file))) { err(`font ${f.family}`, `fonts/${f.file} missing — npm run setup`); continue; }
  if (!backend) { warn(`font ${f.family}`, 'file present (not verified; canvas unavailable)'); continue; }
  const x = backend.createCanvas(10, 10).getContext('2d');
  x.font = `40px "${f.family}"`; const a = x.measureText('Hamburgefonstiv 1997').width;
  x.font = '40px "NoSuchFontXYZ"'; const b = x.measureText('Hamburgefonstiv 1997').width;
  a !== b ? good(`font ${f.family}`, 'registered and renders') : err(`font ${f.family}`, 'file present but the canvas fell back to a default font');
}

const chrome = findChrome();
chrome ? good('chrome', chrome) : warn('chrome', 'not found (only needed for npm run bench browser test); set CHROME_PATH');

const py = findPython();
if (!py) warn('python', 'not found (needed in Phase 4 for sfx/mix/align)');
else {
  good('python', py);
  pyHas(py, 'numpy, scipy') ? good('numpy + scipy', '') : warn('numpy + scipy', 'missing — pip install numpy scipy (Phase 4)');
  pyHas(py, 'faster_whisper') ? good('faster-whisper', '') : warn('faster-whisper', 'missing — pip install faster-whisper (Phase 4)');
}
console.log(fail ? `\n${fail} problem(s) to fix.` : '\nAll required checks passed.');
process.exit(fail ? 1 : 0);
