import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scan, loadProps, ROOT } from '../tools/scan-props.mjs';
import { loadProject } from '../core/project.js';
import { fakeCtx, fakeCanvas } from './fake.mjs';

async function load(aspect, strict = true) {
  await scan();
  const dir = path.join(ROOT, 'projects', 'demo');
  return loadProject({
    props: await loadProps('demo'), aspect, strict, createCanvas: fakeCanvas,
    loadImage: async () => { throw new Error('no images in test'); }, resolvePath: (s) => path.join(dir, s),
    readJSON: async (n, { optional } = {}) => {
      try { return JSON.parse(await fs.readFile(path.join(dir, n), 'utf8')); }
      catch (e) { if (e.code === 'ENOENT' && optional) return null; throw e; }
    },
  });
}
const frame = (P, T) => { const c = fakeCtx(); P.renderer.render(c, T); return c.log; };

test('scan finds solidBg', async () => { assert.ok((await scan()).kit.includes('solidBg')); });

for (const aspect of ['9:16', '16:9']) {
  test(`demo renders every 0.25s without throwing (${aspect}), deterministic`, async () => {
    const P = await load(aspect), d = P.renderer.duration;
    let sawText = false;
    for (let t = 0; t <= d; t += 0.25) {
      const a = frame(P, t), b = frame(P, t);
      assert.deepEqual(a, b, `frame at ${t} differs between renders`);
      if (a.some((l) => l.startsWith('fillText('))) sawText = true;
    }
    assert.ok(sawText, 'captions never drew text');
    assert.notDeepEqual(frame(P, 0.2), frame(P, d - 0.5));
  });
}
