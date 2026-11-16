// tools/render-range.mjs — renders frames [from,to) and pipes them to ffmpeg → one mp4 segment. Used by capture.mjs.
// Usage: node tools/render-range.mjs --project p --aspect 9:16 --fps 30 --from 0 --to 300 --out seg.mp4 [--lib skia] [--draft]
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { findFfmpeg } from './lib/env.mjs';
import { loadNodeProject, makeFrameRenderer } from '../backends/node.js';

const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const project = get('project'), aspect = get('aspect', null), lib = get('lib', 'skia'), out = get('out');
const fps = +get('fps', '30'), from = +get('from', '0'), to = +get('to', '0'), draft = argv.includes('--draft');

async function main() {
  const proj = await loadNodeProject({ project, aspect, lib, strict: true });
  const fr = makeFrameRenderer(proj);
  const { W, H } = proj.size;
  const ow = draft ? W / 2 : W, oh = draft ? H / 2 : H;
  const vf = `scale=${ow}:${oh}:flags=area:out_color_matrix=bt709:out_range=tv,format=yuv420p`;
  const ff = spawn(findFfmpeg(), ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(fps), '-i', '-',
    '-vf', vf, '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'medium', '-crf', draft ? '28' : '23',
    '-tune', 'grain',             // the paper-craft grain overlay is high-entropy noise; this tune keeps its texture at a sane bitrate
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-an', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  ff.stderr.on('data', (d) => { err += d; });
  const closed = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}: ${err.slice(-600)}`)))));
  closed.catch(() => {});
  // M2 fix: a crashed encoder used to hang forever — EPIPE was swallowed and the pending
  // stdin drain never resolved. Race every backpressure wait against encoder exit.
  const died = new Promise((_, rej) => ff.on('close', (c) => { if (c !== 0) rej(new Error(`ffmpeg exited ${c}: ${err.slice(-600)}`)); }));
  died.catch(() => {});
  ff.stdin.on('error', () => {});
  try {
    for (let i = from; i < to; i++) {
      await fr.draw(i / fps);
      let buf = await proj.be.raw(fr.canvas);
      if (lib === 'napi') buf = Buffer.from(buf);
      if (!ff.stdin.write(buf)) await Promise.race([once(ff.stdin, 'drain'), died]);
      if ((i - from) % 5 === 4) console.log(`P ${i - from + 1}`);
    }
    ff.stdin.end();
  } catch (e) {
    ff.kill();
    throw err ? new Error(`${e.message}\nffmpeg: ${err.slice(-600)}`) : e;
  }
  await closed;
  console.log(`P ${to - from}`);
}
main().catch((e) => { console.error(e.stack || e); process.exit(1); });
