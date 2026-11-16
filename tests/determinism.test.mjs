// Same frame → identical pixels, regardless of render order or a fresh load (catches cache/state leaks).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { loadNodeProject, makeFrameRenderer, duration } from '../backends/node.js';

const name = ['hk1997', 'test3'].find((n) => fs.existsSync(new URL(`../projects/${n}/script.json`, import.meta.url)));
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');

async function open() {
  const proj = await loadNodeProject({ project: name, strict: false });
  const r = makeFrameRenderer(proj);
  const draw = typeof r === 'function' ? r : r.draw.bind(r);
  const frame = async (t) => {
    const out = await draw(t);
    if (ArrayBuffer.isView(out)) return out;
    const cv = out ?? r?.canvas ?? r?.cv ?? proj.canvas ?? proj.cv;
    if (!cv) {
      throw new Error(`draw() returned nothing and no canvas was found. renderer keys: [${Object.keys(r || {})}] · project keys: [${Object.keys(proj)}]`);
    }
    return await proj.be.raw(cv);
  };
  return { dur: duration(proj), hash: async (t) => md5(await frame(t)) };
}

test(`frames are repeatable and order-independent (${name ?? 'no project'})`, { skip: !name && 'no project found' }, async () => {
  const a = await open();
  const ts = [0.03, 0.2, 0.4, 0.6, 0.8, 0.97].map((x) => +(x * a.dur).toFixed(3));
  const fwd = []; for (const t of ts) fwd.push(await a.hash(t));
  const rev = []; for (const t of [...ts].reverse()) rev.push(await a.hash(t));
  assert.deepEqual(rev.reverse(), fwd, 'rendering order changed pixels (state leak)');
  const again = []; for (const t of ts) again.push(await a.hash(t));
  assert.deepEqual(again, fwd, 'second pass differs');
  const b = await open();
  const fresh = []; for (const t of ts) fresh.push(await b.hash(t));
  assert.deepEqual(fresh, fwd, 'fresh load differs (sprite cache or global state)');
  assert.ok(new Set(fwd).size > 1, 'all sampled frames identical — is anything animating?');
});
