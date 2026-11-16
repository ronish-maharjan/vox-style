// tools/bench.mjs — compare capture backends on the same scene: speed + determinism (+ PNG per backend in bench-out/).
// Usage: npm run bench -- [project=test10] [--frames 120] [--aspect 9:16] [--save]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT, findChrome, readConfig, writeConfig } from './lib/env.mjs';
import { loadNodeProject, makeFrameRenderer, duration } from '../backends/node.js';

// #10 fix: parseArgs — the old hand-rolled scan swallowed a positional that followed a
// boolean flag (e.g. "bench --save hk1997" silently benchmarked the default project).
const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: { frames: { type: 'string' }, aspect: { type: 'string' }, save: { type: 'boolean' } },
});
const project = positionals[0] ?? 'test10';
const frames = +(flags.frames ?? '120') || 120;
const aspect = flags.aspect ?? null; // null = honour script.meta.aspect
const OUT = path.join(ROOT, 'bench-out');
const sha = (b) => crypto.createHash('sha1').update(b).digest('hex');
fs.mkdirSync(OUT, { recursive: true });

async function benchNode(lib) {
  const proj = await loadNodeProject({ project, aspect, lib });
  const fr = makeFrameRenderer(proj), dur = duration(proj), tp = dur * 0.37;
  const grab = async () => sha(await proj.be.raw(fr.canvas));
  await fr.draw(tp); const h1 = await grab();
  await fr.draw(dur * 0.8); await fr.draw(0.2); await fr.draw(tp);
  const h2 = await grab();
  fs.writeFileSync(path.join(OUT, `${lib}.png`), await proj.be.png(fr.canvas));
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) { await fr.draw((i / frames) * dur); await proj.be.raw(fr.canvas); }
  return { name: lib, fps: frames / ((performance.now() - t0) / 1000), deterministic: h1 === h2, note: `fonts ${proj.be.fonts.length}/4, raw via ${proj.be.rawName}` };
}

async function benchBrowser() {
  const chrome = findChrome();
  if (!chrome) throw new Error('Chrome not found (set CHROME_PATH)');
  const pp = (await import('puppeteer-core')).default;
  const url = `http://localhost:5173/preview/?project=${project}`;
  const up = async () => { try { return (await fetch('http://localhost:5173/')).ok || true; } catch { return false; } };
  let server = null;
  if (!(await up())) {
    server = spawn(process.execPath, [path.join(ROOT, 'tools/preview.mjs'), project], { stdio: 'ignore' });
    for (let i = 0; i < 40 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
  }
  const browser = await pp.launch({ executablePath: chrome, headless: 'new', args: ['--disable-gpu', '--force-color-profile=srgb'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });
    await page.goto(url);
    await page.waitForFunction('typeof window.render === "function"', { timeout: 15000 });
    const grab = (t) => page.evaluate(async (tt) => { await window.render(tt); return document.querySelector('canvas').toDataURL('image/png'); }, t);
    const dur = 8, tp = dur * 0.37;
    const h1 = sha(await grab(tp)); await grab(0.2); await grab(5);
    const h2 = sha(await grab(tp));
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) Buffer.from((await grab((i / frames) * dur)).split(',')[1], 'base64');
    return { name: 'browser', fps: frames / ((performance.now() - t0) / 1000), deterministic: h1 === h2, note: 'toDataURL PNG per frame (assumes window.render + a <canvas>)' };
  } finally { await browser.close(); server?.kill(); }
}

const rows = [];
for (const [name, fn] of [['skia', () => benchNode('skia')], ['napi', () => benchNode('napi')], ['browser', benchBrowser]]) {
  try { rows.push(await fn()); } catch (e) { rows.push({ name, error: String(e.message).split('\n')[0] }); }
}
console.log(`\nbench ${project} ${aspect}, ${frames} frames\n`);
for (const r of rows) console.log(r.error ? `  ${r.name.padEnd(8)} skipped — ${r.error}`
  : `  ${r.name.padEnd(8)} ${r.fps.toFixed(1).padStart(6)} fps   deterministic: ${r.deterministic ? 'yes' : 'NO'}   ${r.note}`);
const ok = rows.filter((r) => !r.error && r.deterministic).sort((a, b) => b.fps - a.fps);
if (!ok.length) { console.log('\nNo deterministic backend — paste this output.'); process.exit(1); }
const win = ok[0];
console.log(`\nfastest deterministic: ${win.name}. Compare bench-out/*.png by eye (fonts, shadows) before trusting it.`);
if (win.name === 'browser') console.log('The browser won: tell me and I will add the Puppeteer capture path (node backends are all that capture.mjs supports today).');
else if (argv.includes('--save')) { writeConfig({ ...readConfig(), backend: win.name }); console.log(`saved backend "${win.name}" to studio.config.json`); }
