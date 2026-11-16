// tests/compile.test.mjs — the intent -> script compiler (P0.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileIntent, pickCueWords, expandShot } from '../tools/compile.mjs';
import { validateScript } from '../tools/validate.mjs';
import { discoverProps } from '../lib/registry.mjs';

const recipes = new Map([
  ['stat-reveal', {
    name: 'stat-reveal',
    params: { value: 'number', label: 'label', cueWord: 'cue' },
    shot: { camera: { move: 'push-in' }, layers: [
      { prop: 'paperBg', options: { variant: 'dots' }, at: 'start' },
      { prop: 'bigNumber', slots: { value: '{{value}}', label: '{{label}}' }, at: 'word:{{cueWord}}' },
    ] },
  }],
]);

const defsOf = async () => {
  const { props } = await discoverProps({});
  return Object.fromEntries([...props].map(([k, v]) => [k, v.def]));
};

test('pickCueWords prefers distinctive content words, never stopwords', () => {
  const line = { text: 'It was the end of a very long era in 1997.' };
  const cues = pickCueWords(line);
  assert.ok(cues.length >= 2);
  assert.ok(!cues.some((c) => ['the', 'was', 'of', 'a', 'in', 'it'].includes(c.word)));
  assert.equal(cues[0].word, '1997');
});

test('pickCueWords skips words already taken by another shot', () => {
  const line = { text: 'Hong Kong changed hands in 1997.' };
  const taken = new Set(['hong']);
  const cues = pickCueWords(line, taken);
  assert.ok(!cues.some((c) => c.word === 'hong'));
});

test('compileIntent expands recipes, auto-picks cue words, emits a valid script', async () => {
  const intent = {
    meta: { title: 'Test video' },
    lines: [
      { id: 'l1', text: 'For 156 years, Hong Kong was a British colony.', shots: [
        { recipe: 'stat-reveal', params: { value: '156', label: 'years of British rule' } },
      ] },
      { id: 'l2', text: 'It was the end of a very long era.' },   // no shots -> neutral default
    ],
  };
  const script = compileIntent(intent, { recipes });
  assert.equal(script.lines.length, 2);
  assert.equal(script.shots.length, 2);
  assert.equal(script.shots[0].line, 'l1');
  assert.equal(script.shots[0].layers[1].slots.value, '156');
  // cue word auto-picked: a distinctive word from the line, not a stopword
  const at = script.shots[0].layers[1].at;
  assert.match(at, /^word:/);
  const cue = at.slice(5);
  assert.ok(!['for', 'years', 'was', 'the', 'a'].includes(cue) || cue === 'hong' || cue === 'british' || cue === 'colony' || cue === '156');

  const defs = await defsOf();
  const res = validateScript({ script, props: defs, aspect: '9:16', assetExists: () => true, allowMissingAssets: true });
  assert.deepEqual(res.errors, []);
});

test('compileIntent splits multi-shot lines across the line with word pivots', async () => {
  const intent = {
    lines: [
      { id: 'l1', text: 'In 1898 Britain leased the New Territories for 99 years.', shots: [
        { recipe: 'stat-reveal', params: { value: '1898', label: 'the lease' } },
        { recipe: 'stat-reveal', params: { value: '99', label: 'years leased' } },
      ] },
    ],
  };
  const script = compileIntent(intent, { recipes });
  assert.equal(script.shots.length, 2);
  assert.ok(script.shots[1].span && script.shots[1].span[0].startsWith('word:'));
  assert.equal(script.shots[0].span[0], 'start');

  const defs = await defsOf();
  const res = validateScript({ script, props: defs, aspect: '9:16', assetExists: () => true, allowMissingAssets: true });
  assert.deepEqual(res.errors, []);
});

test('compileIntent accepts raw shots mixed with recipes', () => {
  const intent = {
    lines: [
      { id: 'l1', text: 'Hello world of paper.', shots: [
        { recipe: 'stat-reveal', params: { value: '42', label: 'the answer' } },
        { layers: [{ prop: 'solidBg' }, { prop: 'stamp', slots: { text: 'DONE' } }], camera: { move: 'drift' } },
      ] },
    ],
  };
  const script = compileIntent(intent, { recipes });
  assert.equal(script.shots[1].layers[0].prop, 'solidBg');
  assert.equal(script.shots[1].camera.move, 'drift');
});

test('compileIntent fails loudly on an unknown recipe or missing required param', () => {
  assert.throws(() => compileIntent({ lines: [{ id: 'l1', text: 'x', shots: [{ recipe: 'nope' }] }] }, { recipes }), /unknown recipe "nope"/);
  // {{value}} is referenced by the recipe but not provided and not auto-pickable -> stays unfilled
  assert.throws(() => compileIntent({ lines: [{ id: 'l1', text: 'some words here', shots: [{ recipe: 'stat-reveal', params: {} }] }] }, {
    recipes: new Map([['stat-reveal', { name: 'stat-reveal', params: { value: 'the number' }, shot: { layers: [{ prop: 'bigNumber', slots: { value: '{{value}}' } }] } }]]),
  }), /unfilled param/);
});

test('a line with a single recipe may skip the shots array', () => {
  const script = compileIntent({ lines: [{ id: 'l1', text: 'The number was 156 clearly.', recipe: 'stat-reveal', params: { value: '156', label: 'the number' } }] }, { recipes });
  assert.equal(script.shots.length, 1);
  assert.equal(script.shots[0].layers[1].slots.value, '156');
});
