// tests/props.test.mjs — auto-tests every prop in both aspects. Run: npm run test:props (also part of npm test). Needs skia-canvas.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { discoverProps, ROOT } from '../lib/registry.mjs';
import { normSpec } from '../tools/lib/types.mjs';
import { seededRandom, hashStr } from '../core/helpers.js';

let skia = true;
try { await import('skia-canvas'); } catch { skia = false; }

const ASPECTS = ['9:16', '16:9'];
const SAFE = { '9:16': { top: 150, bottom: 480, left: 70, right: 70 }, '16:9': { top: 70, bottom: 230, left: 110, right: 110 } };
const sha = (b) => crypto.createHash('sha1').update(b).digest('hex');
const hasInk = (buf) => { for (let i = 3; i < buf.length; i += 4) if (buf[i]) return true; return false; };

const all = new Map((await discoverProps()).props);
const projDir = path.join(ROOT, 'projects');
for (const p of fs.existsSync(projDir) ? fs.readdirSync(projDir) : [])
  if (fs.existsSync(path.join(projDir, p, 'props'))) for (const [k, v] of (await discoverProps({ project: p })).props) all.set(k, v);

const projs = {};
if (skia) {
  const { loadNodeProject } = await import('../backends/node.js');
  for (const a of ASPECTS) projs[a] = await loadNodeProject({ project: 'test10', aspect: a, lib: 'skia', strict: true });
}

for (const [name, e] of all) {
  const def = e.def, m = def.meta, isTr = m.category === 'transitions';
  const ex = { slots: m.example?.slots ?? {}, options: m.example?.options ?? {} };

  test(`prop ${name}: source rules`, () => {
    const src = fs.readFileSync(path.join(e.dir, 'index.js'), 'utf8');
    assert.ok(src.split('\n').length <= 300, 'file is over 300 lines');
    assert.match(src.split('\n')[0], /^\/\/ /, 'first line must be a "// path — what it does. Usage: ..." comment');
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    for (const bad of ['Math.random', 'Date.now', 'performance.now', 'document.', 'window.', 'localStorage'])
      assert.ok(!code.includes(bad), `props must be pure: found ${bad}`);
  });

  for (const aspect of ASPECTS) {
    test(`prop ${name} @ ${aspect}`, { skip: !skia && 'skia-canvas not installed' }, async (t) => {
      const P = projs[aspect], { W, H } = P.size;
      const canvas = P.be.createCanvas(W, H), ctx = canvas.getContext('2d');
      const mkEnv = (assets) => ({
        id: 'proptest', t: 1, p: 0.5, W, H, orientation: W > H ? 'landscape' : 'portrait', safe: SAFE[aspect], theme: P.theme,
        assets: assets ?? P.assets, words: [], rng: (l) => seededRandom(hashStr(`proptest:${l}`)), createCanvas: P.be.createCanvas, sprites: new Map(),
      });
      const px = (opts) => Object.fromEntries(Object.entries(opts).map(([k, v]) => {
        if (typeof v === 'string' && v.endsWith('%')) { const f = parseFloat(v) / 100; return [k, f * (k === 'x' || k === 'w' ? W : H)]; }
        return [k, v];
      }));
      const shoot = async (env, o) => {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, W, H);
        ctx.save(); def.draw(ctx, o, env); ctx.restore();
        return Buffer.from(await P.be.raw(canvas));
      };
      const base = (extra = {}, slots = ex.slots, options = ex.options) =>
        ({ ...slots, ...px(options), appear: 1, exit: 0, opacity: 1, ...(isTr ? { progress: 0.5 } : {}), ...extra });

      // 1. no crash across animation states
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        await shoot(mkEnv(), base(isTr ? { progress: v } : { appear: v }));
        if (!isTr) await shoot(mkEnv(), base({ appear: 1, exit: v }));
      }

      // 2. visible when fully in (transitions: fully covered)
      assert.ok(hasInk(await shoot(mkEnv(), base())), 'nothing drawn when fully in');

      // 3. transitions draw nothing at progress 0
      if (isTr) assert.ok(!hasInk(await shoot(mkEnv(), base({ progress: 0 }))), 'transition must be invisible at progress 0');

      // 4. deterministic: fresh cache, warm cache, fresh env
      const env1 = mkEnv();
      const h1 = sha(await shoot(env1, base())), h2 = sha(await shoot(env1, base())), h3 = sha(await shoot(mkEnv(), base()));
      assert.equal(h2, h1, 'cache-hit frame differs from cache-miss frame (sprite key missing an input?)');
      assert.equal(h3, h1, 'same inputs gave different pixels (hidden state or unseeded randomness)');

      // 5. missing assets give a placeholder, not a crash
      const slots = { ...ex.slots }, options = { ...ex.options };
      let hasAsset = false;
      for (const [bag, specs] of [[slots, m.slots], [options, m.options]])
        for (const [k, v] of Object.entries(specs ?? {})) if (normSpec(v).base === 'asset') { bag[k] = 'does/not/exist.png'; hasAsset = true; }
      if (hasAsset) {
        const noAssets = { get: () => null, has: () => false };
        assert.ok(hasInk(await shoot(mkEnv(noAssets), base({}, slots, options))), 'missing asset: expected a visible placeholder');
      }

      // 6. empty input never crashes
      await shoot(mkEnv(), { appear: 1, exit: 0, opacity: 1, ...(isTr ? { progress: 0.5 } : {}) });

      // 7. soft checks (reported, not failing)
      if (!isTr && hasInk(await shoot(mkEnv(), base({ appear: 0 })))) t.diagnostic(`${name}: draws something at appear=0 (pops in instead of animating)`);
      if (!isTr && hasInk(await shoot(mkEnv(), base({ appear: 1, exit: 1 })))) t.diagnostic(`${name}: still visible at exit=1`);
    });
  }
}
