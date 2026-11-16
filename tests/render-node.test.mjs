// tests/render-node.test.mjs — end-to-end: test10 renders in both aspects, non-blank, deterministic. Needs skia-canvas.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

let skia = true;
try { await import('skia-canvas'); } catch { skia = false; }

test('test10 renders deterministically in both aspects', { skip: !skia && 'skia-canvas not installed' }, async () => {
  const { loadNodeProject, makeFrameRenderer, duration } = await import('../backends/node.js');
  const sha = (b) => crypto.createHash('sha1').update(b).digest('hex');
  for (const aspect of ['9:16', '16:9']) {
    const proj = await loadNodeProject({ project: 'test10', aspect, lib: 'skia', strict: true });
    const fr = makeFrameRenderer(proj), dur = duration(proj);
    const grab = async () => proj.be.raw(fr.canvas);
    for (const t of [0, 0.25, dur * 0.3, dur * 0.6, dur - 0.05]) {
      await fr.draw(t);
      const px = await grab();
      assert.equal(px.length, fr.W * fr.H * 4, `${aspect} t=${t}: raw size`);
      const seen = new Set();
      for (let i = 0; i < px.length; i += 997) seen.add(px[i]);
      assert.ok(seen.size > 20, `${aspect} t=${t}: frame looks blank`);
    }
    const tp = dur * 0.45;
    await fr.draw(tp); const h1 = sha(await grab());
    await fr.draw(0.1); await fr.draw(dur * 0.9); await fr.draw(tp);
    assert.equal(sha(await grab()), h1, `${aspect}: same frame must be pixel-identical`);
  }
});
