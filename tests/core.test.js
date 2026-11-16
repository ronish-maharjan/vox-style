import test from 'node:test';
import assert from 'node:assert/strict';
import { seg, ease, easeOutBack, spring, noise, EASES } from '../core/easing.js';
import { seededRandom, resolveLen, resolveGeometry, fitText, textWrap, tornRect, wobblePts, resample } from '../core/helpers.js';
import { getTheme } from '../core/theme.js';
import { cameraState, applyCamera, MOVES } from '../core/camera.js';
import { createAssets } from '../core/assets.js';

test('easing endpoints', () => {
  for (const n of EASES) { assert.ok(Math.abs(ease(n, 0)) < 1e-9, n + ' @0'); assert.ok(Math.abs(ease(n, 1) - 1) < 1e-9, n + ' @1'); }
  assert.equal(seg(5, 2, 4), 1); assert.equal(seg(1, 2, 4), 0); assert.equal(seg(3, 2, 4), 0.5);
  assert.ok(easeOutBack(0.8) > 1, 'overshoots'); assert.ok(spring(0.3) > 0);
});

test('rng + noise are deterministic', () => {
  const a = seededRandom('prop1'), b = seededRandom('prop1'), c = seededRandom('prop2');
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  assert.deepEqual(sa, sb); assert.notDeepEqual(sa, [c(), c(), c()]);
  for (let i = 0; i < 200; i++) { const n = noise(i * 0.37, 5); assert.ok(n >= -1 && n <= 1); assert.equal(n, noise(i * 0.37, 5)); }
});

test('resolveLen / resolveGeometry', () => {
  assert.equal(resolveLen('50%', 1080), 540); assert.equal(resolveLen(300, 1080), 300);
  assert.equal(resolveLen({ portrait: '50%', landscape: '30%' }, 1000, 'landscape'), 300);
  const g = resolveGeometry({ x: '50%', y: '25%', w: '80%', r: '10%' }, { W: 1080, H: 1920, orientation: 'portrait' });
  assert.deepEqual([g.x, g.y, g.w, g.r], [540, 480, 864, 108]);
});

test('theme formats', () => {
  assert.equal(getTheme('default', '9:16').format.W, 1080);
  assert.equal(getTheme('default', '16:9').format.W, 1920);
  assert.throws(() => getTheme('nope')); assert.throws(() => getTheme('default', '4:3'));
});

const fakeCtx = { font: '', measureText(s) { return { width: s.length * parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)[1]) * 0.5 }; } };
test('fitText fits or reports it cannot', () => {
  const r = fitText(fakeCtx, 'Hong Kong changed hands in 1997', { maxW: 600, maxH: 300, family: 'x', maxSize: 120 });
  assert.ok(r.fits && r.height <= 300);
  fakeCtx.font = '700 20px x';
  assert.ok(textWrap(fakeCtx, 'aaa bbb ccc ddd', 70).length > 1);
  assert.equal(fitText(fakeCtx, 'x'.repeat(500), { maxW: 100, maxH: 50, family: 'x' }).fits, false);
});

test('torn/wobble/resample stable per seed', () => {
  const t1 = tornRect(400, 300, seededRandom('a')), t2 = tornRect(400, 300, seededRandom('a'));
  assert.deepEqual(t1, t2);
  const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  assert.deepEqual(wobblePts(line, seededRandom(1), 3), wobblePts(line, seededRandom(1), 3));
  assert.ok(resample(line, 10).length >= 10);
});

// Camera invariant: for every move, depth and progress, the whole viewport stays covered by the world.
function recorder() {
  const m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  return {
    m,
    translate(x, y) { m.e += m.a * x + m.c * y; m.f += m.b * x + m.d * y; },
    scale(x, y) { m.a *= x; m.b *= x; m.c *= y; m.d *= y; },
    rotate(r) { const C = Math.cos(r), S = Math.sin(r), a = m.a, b = m.b, c = m.c, d = m.d; m.a = a * C + c * S; m.b = b * C + d * S; m.c = -a * S + c * C; m.d = -b * S + d * C; },
  };
}
for (const [W, H, orientation] of [[1080, 1920, 'portrait'], [1920, 1080, 'landscape']]) {
  test(`camera never exposes edges (${orientation})`, () => {
    for (const move of MOVES) for (const depth of [0, 0.5, 1]) for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const st = cameraState({ move }, { p, t: p * 3, W, H, orientation, seed: 7 });
      const ctx = recorder(); applyCamera(ctx, st, depth);
      const { a, b, c, d, e, f } = ctx.m, det = a * d - b * c;
      for (const [X, Y] of [[0, 0], [W, 0], [W, H], [0, H]]) {
        const x = (d * (X - e) - c * (Y - f)) / det, y = (-b * (X - e) + a * (Y - f)) / det;
        assert.ok(x >= -0.5 && x <= W + 0.5 && y >= -0.5 && y <= H + 0.5, `${move} depth=${depth} p=${p} exposes (${x.toFixed(1)},${y.toFixed(1)})`);
      }
    }
  });
}
test('camera determinism + unknown move throws', () => {
  const o = { p: 0.4, t: 1.2, W: 1080, H: 1920, seed: 3 };
  assert.deepEqual(cameraState({ move: 'shake' }, o), cameraState({ move: 'shake' }, o));
  assert.throws(() => cameraState({ move: 'spin' }, o));
});

test('assets never crash on missing', async () => {
  const mk = () => ({ width: 10, height: 10, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) });
  const assets = createAssets({ loadImage: async () => { throw new Error('nope'); }, createCanvas: mk });
  const missing = await assets.preload({ photo1: 'assets/x.jpg' });
  assert.equal(missing.length, 1); assert.equal(assets.get('photo1').placeholder, true); assert.equal(assets.get('ghost').placeholder, true);
});
