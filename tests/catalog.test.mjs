// tests/catalog.test.mjs — types, validator, catalog, registry. Runs with `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normSpec, checkValue, isRequired } from '../tools/lib/types.mjs';
import { discoverProps, toDefs } from '../lib/registry.mjs';
import { validateScript, checkPropMeta, lintTimeline } from '../tools/validate.mjs';
import { buildCatalog } from '../tools/catalog.mjs';

const bigNumber = {
  meta: {
    name: 'bigNumber', category: 'data',
    use: 'Show one huge number. Great for stats.', avoid: 'More than one number at once.',
    slots: { value: 'string', label: 'string?' },
    options: { color: 'color', size: 'range:0..1', align: 'enum:left|center' },
    defaultDuration: 2.5, example: { slots: { value: '1997' }, options: {} },
  },
  draw() {},
};
const photo = {
  meta: { name: 'photo', use: 'A photo.', avoid: 'Text.', slots: { src: 'asset' }, options: {}, defaultDuration: 3, example: { slots: { src: 'a.jpg' }, options: {} } },
  draw() {},
};
const props = { bigNumber, photo };

const good = () => ({
  lines: [{ id: 'l1', text: 'Hong Kong changed hands in 1997.', caps: 'Hong Kong|changed hands|in *1997*' }],
  shots: [{ line: 'l1', camera: 'push-in', layers: [
    { prop: 'bigNumber', slots: { value: '1997' }, options: { color: 'ink', size: 0.5 }, at: 'word:1997' } ] }],
});
const run = (s, extra = {}) => validateScript({ script: s, props, ...extra });
const has = (list, re) => list.some((m) => re.test(m));

test('types: normSpec + checkValue', () => {
  const e = normSpec('enum:a|b?');
  assert.equal(e.base, 'enum'); assert.equal(e.optional, true); assert.deepEqual(e.values, ['a', 'b']);
  assert.equal(normSpec('range:0..1').max, 1);
  assert.equal(normSpec('range:-2.5..3.5').min, -2.5);
  assert.equal(normSpec('wibble').base, 'unknown');
  assert.equal(normSpec({ type: 'number', default: 3 }).default, 3);
  assert.equal(isRequired(normSpec('string')), true);
  assert.equal(isRequired(normSpec('string?')), false);
  assert.equal(checkValue(normSpec('number'), 'x') !== null, true);
  assert.equal(checkValue(normSpec('length'), '50%'), null);
  assert.equal(checkValue(normSpec('range:0..1'), 2) !== null, true);
  assert.equal(checkValue(normSpec('enum:a|b'), 'c') !== null, true);
  assert.equal(checkValue(normSpec('number'), undefined), null);
});

test('validate: a good script has no errors', () => {
  const r = run(good());
  assert.deepEqual(r.errors, []); assert.deepEqual(r.missingProps, []);
});

test('validate: typo vs truly missing prop', () => {
  const s = good(); s.shots[0].layers[0].prop = 'bigNumbr';
  const r = run(s);
  assert.ok(has(r.errors, /did you mean "bigNumber"/)); assert.equal(r.missingProps.length, 0);
  s.shots[0].layers[0].prop = 'confetti';
  const r2 = run(s);
  assert.equal(r2.missingProps[0].name, 'confetti');
});

test('validate: slots, options, types', () => {
  const s = good();
  s.shots[0].layers[0].slots = { valeu: '1' };
  let r = run(s);
  assert.ok(has(r.errors, /did you mean "value"/)); assert.ok(has(r.errors, /missing required slot "value"/));
  s.shots[0].layers[0].slots = { value: '1', color: 'red' };
  assert.ok(has(run(s).errors, /"color" is an option/));
  s.shots[0].layers[0].slots = { value: '1' };
  s.shots[0].layers[0].options = { size: 3 };
  assert.ok(has(run(s).errors, /options\.size.*0 to 1/));
  s.shots[0].layers[0].options = { align: 'right' };
  assert.ok(has(run(s).errors, /one of left \| center/));
  s.shots[0].layers[0].options = { x: 100, sparkle: true };
  r = run(s);
  assert.deepEqual(r.errors, []); assert.ok(has(r.warnings, /no option "sparkle"/));
});

test('validate: layer keys, cues, placeholders, line ids', () => {
  let s = good(); s.shots[0].layers[0].text = 'hi';
  assert.ok(has(run(s).errors, /unknown layer key "text"/));
  s = good(); s.shots[0].layers[0].at = 'sometime';
  assert.ok(has(run(s).errors, /not a valid cue/));
  for (const ok of ['start', 'end', 't:1.5', 'word:kong', 'word:the#2', 'word:the#2+0.2s', 'start-0.1s', 'word:well-known']) {
    s = good(); s.shots[0].layers[0].at = ok;
    assert.deepEqual(run(s).errors, [], ok);
  }
  s = good(); s.shots[0].layers[0].slots.value = '{{value}}';
  assert.ok(has(run(s).errors, /unfilled placeholder/));
  s = good(); s.lines.push({ id: 'l1', text: 'again' });
  assert.ok(has(run(s).errors, /duplicate line id/));
  s = good(); s.lines[0].caps = 'a *b';
  assert.ok(has(run(s).errors, /unbalanced/));
  s = good(); s.shots[0].camera = 'zoomy';
  assert.ok(has(run(s).errors, /unknown camera move/));
});

test('validate: assets', () => {
  const s = good();
  s.shots[0].layers.push({ prop: 'photo', slots: { src: 'nope.jpg' } });
  const r = run(s, { assetExists: () => false });
  assert.ok(has(r.errors, /asset "nope.jpg" not found/));
  assert.deepEqual(run(s, { assetExists: () => true }).errors, []);
});

test('validate: text-heavy and safe-area lints', () => {
  const s = good();
  const heavy = () => ({ prop: 'bigNumber', slots: { value: 'x', label: 'a'.repeat(50) } });
  s.shots[0].layers.push(heavy(), heavy(), heavy());
  assert.ok(has(run(s).warnings, /3 text-heavy layers/));
  const t = good();
  t.shots[0].layers.push({ ...heavy(), options: { x: '50%', y: 1700 } });
  assert.ok(has(run(t).warnings, /outside the safe area/));
  const u = good();
  u.shots[0].layers.push({ ...heavy(), options: { x: '50%', y: 900 } });
  assert.ok(!has(run(u).warnings, /safe area/));
});

test('validate: transitions', () => {
  const s = good(); s.shots[0].transition = { type: 'wipe' };
  assert.equal(run(s).missingProps[0].name, 'wipe');
  s.shots[0].transition = { duration: 1 };
  assert.ok(has(run(s).errors, /needs \{ "type"/));
});

test('lintTimeline: quiet gaps; unknown shape is skipped', () => {
  const tl = { shots: [{ start: 0, layers: [{ start: 0.5 }] }, { start: 6, layers: [] }], end: 7 };
  assert.ok(lintTimeline(tl).warnings.length >= 1);
  assert.ok(lintTimeline({ nope: 1 }).note);
});

test('checkPropMeta: healthy, broken, bad example', () => {
  assert.deepEqual(checkPropMeta(bigNumber), []);
  assert.ok(checkPropMeta({ meta: { name: 'x' }, draw() {} }).length > 0);
  const bad = { ...bigNumber, meta: { ...bigNumber.meta, example: { slots: {}, options: {} } } };
  assert.ok(has(checkPropMeta(bad), /missing required slot "value"/));
  const dup = { ...bigNumber, meta: { ...bigNumber.meta, options: { value: 'string' } } };
  assert.ok(has(checkPropMeta(dup), /both a slot and an option/));
});

test('registry: discovers kit props and they pass meta checks', async () => {
  const { props: found, problems } = await discoverProps();
  assert.deepEqual(problems, []);
  assert.ok(found.has('solidBg'));
  for (const e of found.values()) assert.deepEqual(checkPropMeta(e.def), [], e.name);
  assert.ok('solidBg' in toDefs(found));
});

test('catalog: sections, escaping, determinism, hidden recipes', () => {
  const entries = [
    { name: 'bigNumber', def: bigNumber, category: 'data', source: 'kit' },
    { name: 'photo', def: photo, category: 'photos', source: 'kit' },
  ];
  const recipes = [
    { name: 'ok', use: 'Works.', params: { v: 'value' }, shot: { layers: [{ prop: 'bigNumber', slots: { value: '{{v}}' } }] } },
    { name: 'later', use: 'Needs stamp.', shot: { layers: [{ prop: 'stamp' }] } },
  ];
  const a = buildCatalog({ header: '# Hi', entries, recipes });
  const b = buildCatalog({ header: '# Hi', entries, recipes });
  assert.equal(a.md, b.md);
  assert.match(a.md, /## Choosing props/);
  assert.match(a.md, /#### bigNumber/);
  assert.match(a.md, /\*\*Do not:\*\* More than one number at once\./);
  assert.match(a.md, /enum:left\\\|center/);
  assert.match(a.md, /### ok/);
  assert.doesNotMatch(a.md, /### later/);
  assert.deepEqual(a.unavailable, [{ name: 'later', missing: ['stamp'] }]);
});
