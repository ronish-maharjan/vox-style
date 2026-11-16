// tests/place.test.mjs — placement sugar + collision lint (P0.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, resolvePlace } from '../core/director.js';
import { validateScript } from '../tools/validate.mjs';
import { discoverProps } from '../lib/registry.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/registry.mjs';

const words = { lines: [{ id: 'l1', start: 0, end: 3, words: [{ w: 'hello', n: 'hello', start: 0.2, end: 0.5 }] }] };

const defsOf = async () => {
  const { props } = await discoverProps({ root: ROOT });
  return Object.fromEntries([...props].map(([k, v]) => [k, v.def]));
};

const script = (layers) => ({
  lines: [{ id: 'l1', text: 'hello' }],
  shots: [{ line: 'l1', layers }],
});

test('resolvePlace maps named placements to safe-area x/y', () => {
  assert.deepEqual(resolvePlace('center'), { x: '50%', y: '50%' });
  assert.deepEqual(resolvePlace('top'), { x: '50%', y: '22%' });
  assert.deepEqual(resolvePlace('bottom'), { x: '50%', y: '78%' });
  assert.deepEqual(resolvePlace({ x: '30%', y: '60%' }), { x: '30%', y: '60%' });
  assert.deepEqual(resolvePlace('stack:1/3', 0, 3), { x: '50%', y: '42%' });
  assert.equal(resolvePlace('nonsense'), null);
});

test('director resolves place into options x/y (explicit geometry wins)', async () => {
  const props = await defsOf();
  const tl = buildTimeline(script([
    { prop: 'solidBg' },
    { prop: 'bigNumber', slots: { value: '156' }, place: 'upper' },
    { prop: 'paperScrap', slots: { text: 'HELLO' }, place: 'lower' },
    { prop: 'stamp', slots: { text: 'OK' }, place: 'bottom', options: { x: '20%' } },
  ]), words, { props });
  const [, a, b, c] = tl.shots[0].layers;
  assert.equal(a.options.y, '34%');
  assert.equal(a.options.x, '50%');
  assert.equal(b.options.y, '66%');
  assert.equal(c.options.x, '20%');      // explicit wins over place
  assert.equal(c.options.y, '78%');      // y still filled from place
});

test('director rejects a bad place value', async () => {
  const props = await defsOf();
  assert.throws(() => buildTimeline(script([{ prop: 'solidBg' }, { prop: 'stamp', slots: { text: 'X' }, place: 'diagonal' }]), words, { props }), /bad place/);
});

test('validator flags overlapping content layers with a fix suggestion', async () => {
  const props = await defsOf();
  const res = validateScript({
    script: script([
      { prop: 'solidBg' },
      { prop: 'bigNumber', slots: { value: '156' }, options: { x: '50%', y: '40%', w: 600, h: 400 } },
      { prop: 'barChart', slots: { data: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }] }, options: { x: '50%', y: '45%', w: 600, h: 400 } },
    ]),
    props, aspect: '9:16', assetExists: () => true,
  });
  assert.deepEqual(res.errors, []);
  assert.ok(res.warnings.some((w) => /overlap on screen/.test(w)), res.warnings.join('\n'));
});

test('validator does not flag annotations or target-locked layers', async () => {
  const props = await defsOf();
  const res = validateScript({
    script: script([
      { prop: 'solidBg' },
      { prop: 'bigNumber', slots: { value: '156' }, id: 'big', options: { x: '50%', y: '40%', w: 600, h: 400 } },
      { prop: 'markerCircle', options: { w: 600, h: 400 }, target: 'big' },
    ]),
    props, aspect: '9:16', assetExists: () => true,
  });
  assert.deepEqual(res.errors, []);
  assert.ok(!res.warnings.some((w) => /overlap on screen/.test(w)), res.warnings.join('\n'));
});

test('validator accepts place on a layer', async () => {
  const props = await defsOf();
  const res = validateScript({
    script: script([{ prop: 'solidBg' }, { prop: 'stamp', slots: { text: 'OK' }, place: 'bottom' }]),
    props, aspect: '9:16', assetExists: () => true,
  });
  assert.deepEqual(res.errors, []);
});

test('real projects still validate without new false-positive collisions', async () => {
  const props = await defsOf();
  for (const p of ['demo', 'hk1997', 'intent-demo']) {
    const dir = path.join(ROOT, 'projects', p);
    if (!fs.existsSync(path.join(dir, 'script.json'))) continue;
    const s = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
    const res = validateScript({ script: s, props, aspect: s.meta?.aspect || '9:16', assetExists: () => true, allowMissingAssets: true });
    assert.deepEqual(res.errors, [], `${p}: ${res.errors.join('; ')}`);
  }
});
