// tests/fixes.test.mjs — regression tests for the code-review fixes (C1-C3, M1, M3, M5, M6)
// plus the bounds registry / target feature (PR1). Uses the fake canvas like render.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { scan, loadProps, ROOT } from '../tools/scan-props.mjs';
import { buildTimeline } from '../core/director.js';
import { collectEvents } from '../tools/lib/events.mjs';
import { validateScript, validateProject } from '../tools/validate.mjs';
import { normSpec, checkValue } from '../tools/lib/types.mjs';
import { loadProject } from '../core/project.js';
import { createRenderer } from '../core/renderer.js';
import { fakeCtx, fakeCanvas } from './fake.mjs';

let props = null;
test.before(async () => {
  await scan();
  props = await loadProps('test10'); // kit props + any test10-local props
});

const mkScript = () => ({
  meta: { aspect: '9:16' },
  lines: [
    { id: 'l1', text: 'Alpha beta gamma delta' },
    { id: 'l2', text: 'Epsilon zeta eta theta' },
    { id: 'l3', text: 'Iota kappa lambda mu' },
  ],
  shots: [
    { line: 'l1', transition: { type: 'wipe' }, layers: [{ prop: 'paperBg' }] },
    { line: 'l2', transition: { type: 'paperSlide', duration: 0.7 }, layers: [{ prop: 'paperBg' }] },
    { line: 'l3', transition: { type: 'wipe' }, layers: [{ prop: 'paperBg' }] }, // last shot: ignored by the director
  ],
});

// ── C1: transition sounds derive from the director's timeline ──────
test('C1: transition SFX anchor to tl.transitions[].start, last shot excluded', async () => {
  const tl = buildTimeline(mkScript(), null, { props });
  assert.equal(tl.transitions.length, 2, 'a transition on the LAST shot must be dropped');
  const { events } = collectEvents({ tl, script: mkScript(), words: null, auto: true });
  const trEvents = events.filter((e) => e.why.startsWith('transition '));
  assert.equal(trEvents.length, 2);
  for (const tr of tl.transitions) {
    const hit = trEvents.find((e) => e.why === `transition ${tr.prop}`);
    assert.ok(hit, `missing sound for transition ${tr.id}`);
    assert.equal(hit.t, tr.start, `sound for ${tr.id} must start with the visual (straddling the cut), not at the declaring shot's start`);
    assert.ok(hit.t >= 0);
  }
});

// ── M1: sfx gain is the one field (volume is gone) ─────────────────
test('M1: director records sfx gain (not volume)', async () => {
  const s = mkScript();
  s.shots[0].sfx = [{ type: 'pop', at: 'word:beta', gain: 0.7 }];
  const tl = buildTimeline(s, null, { props });
  assert.equal(tl.sfx.length, 1);
  assert.equal(tl.sfx[0].gain, 0.7);
  assert.equal(tl.sfx[0].type, 'pop');
  assert.equal('volume' in tl.sfx[0], false);
});

// ── M5: shot.sfx is schema-validated ───────────────────────────────
test('M5: validate rejects bare-string and bad sfx entries', async () => {
  const bare = mkScript();
  bare.shots[0].sfx = 'pop';
  const r1 = validateScript({ script: bare, props });
  assert.ok(r1.errors.some((e) => e.includes('"sfx" must be an array')), r1.errors.join(' | '));

  const badType = mkScript();
  badType.shots[0].sfx = [{ type: 'explosion', at: 'start' }];
  const r2 = validateScript({ script: badType, props });
  assert.ok(r2.errors.some((e) => e.includes('unknown sfx type "explosion"')), r2.errors.join(' | '));

  const good = mkScript();
  good.shots[0].sfx = [{ type: 'pop', at: 'word:beta', gain: 0.8 }];
  const r3 = validateScript({ script: good, props });
  assert.ok(!r3.errors.some((e) => e.includes('sfx')), r3.errors.join(' | '));
});

// ── M6: the length grammar is the runtime grammar ───────────────────
test('M6: length checks follow core/protocol.js (no loose strings, orientation objects ok)', () => {
  const L = normSpec('length');
  assert.ok(checkValue(L, '50pxX') !== null, 'garbage strings must be rejected');
  assert.ok(checkValue(L, '50px') !== null, 'px-suffixed strings break resolveLen and must be rejected');
  assert.equal(checkValue(L, '50%'), null);
  assert.equal(checkValue(L, '50'), null);
  assert.equal(checkValue(L, 120), null);
  assert.equal(checkValue(L, { portrait: '10%', landscape: 300 }), null, 'orientation objects are legitimate');
  assert.ok(checkValue(L, { weird: 3 }) !== null, 'unknown orientation keys must be rejected');
});

// ── C2: script.meta.aspect flows through the pipeline ──────────────
test('C2: meta.aspect wins when no explicit aspect is given; an explicit flag still wins', async () => {
  const script169 = mkScript();
  script169.meta.aspect = '16:9';
  const mk = (s, aspect) => loadProject({
    readJSON: async (n, { optional } = {}) => (n === 'script.json' ? s : optional ? null : (() => { throw new Error('missing ' + n); })()),
    loadImage: async () => { throw new Error('no images'); },
    createCanvas: fakeCanvas, resolvePath: (x) => x, props, ...(aspect ? { aspect } : {}),
  });
  const fromMeta = await mk(script169);
  assert.equal(fromMeta.theme.format.W, 1920, 'script asked for 16:9 and nothing overrode it');
  assert.equal(fromMeta.aspect, '16:9');
  const forced = await mk(script169, '9:16');
  assert.equal(forced.theme.format.W, 1080, 'an explicit 9:16 flag must beat meta.aspect');
});

test('C2: validateProject resolves aspect from the script and reports it', async () => {
  const res = await validateProject({ project: 'test10', dry: false }); // test10 meta.aspect: 9:16
  assert.equal(res.aspect, '9:16');
  assert.equal(res.errors.length, 0, res.errors.join(' | '));
});

// ── M3: flag parsing no longer eats the --aspect value ─────────────
test('M3: validate --aspect 16:9 does not mistake the value for a project', () => {
  const out = execFileSync(process.execPath,
    [path.join(ROOT, 'tools/validate.mjs'), 'test10', '--aspect', '16:9', '--no-dry-run'],
    { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /validate test10 \(16:9\)/);
  assert.match(out, /✔ script is valid/);
});

// ── C3b: catalog + prop meta mention only real props/keys ──────────
test('C3: catalog and prop meta reference no unknown prop names', async () => {
  const catalog = await fs.readFile(path.join(ROOT, 'CATALOG.md'), 'utf8');
  const recipesDir = path.join(ROOT, 'recipes');
  const ok = new Set(['name', 'use', 'avoid', 'category', 'defaultDuration', 'space', 'depth', 'enter', 'enterEase', 'example', 'box', 'schemaVersion']);
  for (const [n, def] of Object.entries(props)) {
    ok.add(n);
    for (const bag of ['slots', 'options']) for (const k of Object.keys(def.meta?.[bag] ?? {})) ok.add(k);
  }
  for (const m of catalog.matchAll(/\{\{([^}]+)\}\}/g)) ok.add(m[1].trim());
  for (const f of await fs.readdir(recipesDir)) {
    if (!f.endsWith('.json')) continue;
    const r = JSON.parse(await fs.readFile(path.join(recipesDir, f), 'utf8'));
    for (const k of Object.keys(r.params ?? {})) ok.add(k);
  }
  const camel = /\b[a-z]+[A-Z][A-Za-z0-9]*\b/g;
  const texts = [catalog, ...Object.values(props).map((d) => `${d.meta?.use ?? ''} ${d.meta?.avoid ?? ''}`)]
    .map((t) => t.replace(/\\n/g, ' ')); // JSON-escaped newlines inside examples create fake camelCase tokens
  ok.add('fromCue'); ok.add('toCue'); // documented span-cue grammar, not prop names
  const hits = new Set();
  for (const t of texts) for (const m of t.matchAll(camel)) if (!ok.has(m[0])) hits.add(m[0]);
  assert.deepEqual([...hits].sort(), [], 'CATALOG.md / prop meta mention names that are neither props nor declared keys — documentation drift');
});

// ── PR1: bounds registry + target inheritance ──────────────────────
test('PR1: layers register their box; target layers inherit box, space and depth', async () => {
  const captured = {};
  const spy = {
    meta: { name: 'spy', category: 'test', use: 'records its options', avoid: 'none', slots: {}, options: {}, defaultDuration: 3, space: 'world', depth: 0.5, example: { slots: {}, options: {} } },
    draw(ctx, o, env) { captured[env.id] = { x: o.x, y: o.y, w: o.w, h: o.h }; },
  };
  const script = {
    meta: { aspect: '9:16' },
    lines: [{ id: 'l1', text: 'One two three four' }],
    shots: [{
      line: 'l1',
      layers: [
        { prop: 'spy', id: 'bg' },
        { prop: 'spy', id: 't1', options: { x: 300, y: 500, w: 400, h: 260 } },
        { prop: 'spy', id: 'a1', target: 't1', options: { pad: '10%' } },
      ],
    }],
  };
  const P = await loadProject({
    readJSON: async (n, { optional } = {}) => (n === 'script.json' ? script : optional ? null : (() => { throw new Error('missing ' + n); })()),
    loadImage: async () => { throw new Error('no images'); },
    createCanvas: fakeCanvas, resolvePath: (x) => x, props: { ...props, spy },
  });
  const ctx = fakeCtx();
  P.renderer.render(ctx, 1.5);
  const b = P.renderer.bounds();
  assert.deepEqual(b.t1, { x: 300, y: 500, w: 400, h: 260, space: 'world', depth: 0.5 });
  // pad '10%' = 40px (10% of the target's 400px width), applied symmetrically
  assert.deepEqual(captured.a1, { x: 260, y: 460, w: 480, h: 340 });
  assert.equal(captured.t1.x, 300); // target keeps its own declared box
});

test('PR1: strict render fails clearly when a target has no box', async () => {
  const spy = {
    meta: { name: 'spy', category: 'test', use: 'x', avoid: 'x', slots: {}, options: {}, defaultDuration: 3, space: 'world', depth: 0.5, example: { slots: {}, options: {} } },
    draw() {},
  };
  const script = {
    meta: {},
    lines: [{ id: 'l1', text: 'One two three four' }],
    shots: [{ line: 'l1', layers: [
      { prop: 'spy', id: 'bg' },
      { prop: 'spy', id: 'a1', target: 'ghost' },
    ] }],
  };
  const P = await loadProject({
    readJSON: async (n, { optional } = {}) => (n === 'script.json' ? script : optional ? null : (() => { throw new Error('missing ' + n); })()),
    loadImage: async () => { throw new Error('no images'); },
    createCanvas: fakeCanvas, resolvePath: (x) => x, props: { ...props, spy }, strict: true,
  });
  assert.throws(() => P.renderer.render(fakeCtx(), 1.5), /target "ghost" has no box/);
});
