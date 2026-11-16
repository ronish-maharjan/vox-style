import test from 'node:test';
import assert from 'node:assert/strict';
import { norm, estimateWords, mapTokens } from '../core/words.js';
import { resolveTime, buildTimeline, shotAt } from '../core/director.js';

const mk = () => ({
  meta: {},
  lines: [
    { id: 'l1', text: 'In 1997, Hong Kong changed hands.', say: 'In nineteen ninety-seven, Hong Kong changed hands.', caps: 'In *1997*|Hong Kong changed hands.' },
    { id: 'l2', text: 'It was the end of a very long era.' },
  ],
  shots: [
    { line: 'l1', layers: [{ prop: 'solidBg' }, { prop: 'solidBg', id: 'x', at: 'word:kong', until: 'word:hands' }],
      sfx: [{ type: 'pop', at: 'word:hong' }], transition: { type: 'wipe' } },
    { line: 'l2', layers: [] },
  ],
});
const props = { solidBg: { meta: { defaultDuration: 3 }, draw() {} }, wipe: { meta: {}, draw() {} } };

test('norm', () => {
  assert.equal(norm('1997,'), '1997'); assert.equal(norm('“Hong”'), 'hong');
  assert.equal(norm('ninety-seven'), 'ninetyseven'); assert.equal(norm('—'), '');
});

test('estimateWords uses say, is ordered', () => {
  const e = estimateWords(mk().lines);
  assert.equal(e.lines[0].words.length, 7);
  assert.ok(e.lines[1].start > e.lines[0].end);
  const ws = e.lines[0].words;
  for (let i = 1; i < ws.length; i++) assert.ok(ws[i].start > ws[i - 1].start);
});

test('mapTokens maps 1997 onto two spoken words', () => {
  const m = mapTokens(['in', '1997', 'hong', 'kong', 'changed', 'hands'], ['in', 'nineteen', 'ninetyseven', 'hong', 'kong', 'changed', 'hands']);
  assert.deepEqual(m, [[0, 0], [1, 2], [3, 3], [4, 4], [5, 5], [6, 6]]);
});

test('resolveTime: words, #n, offsets, errors', () => {
  const L = estimateWords(mk().lines).lines[0];
  const words = L.words.map((w) => ({ ...w, n: norm(w.w) })), c = { start: L.start, end: L.end, words, label: 't' };
  const kong = words.find((w) => w.n === 'kong');
  assert.equal(resolveTime('word:kong', c), kong.start);
  assert.ok(Math.abs(resolveTime('word:kong+0.2s', c) - kong.start - 0.2) < 1e-9);
  assert.equal(resolveTime('t:1.5', c), L.start + 1.5);
  assert.throws(() => resolveTime('word:in#2', c), /Spoken words/);
  assert.throws(() => resolveTime('word:handover', c), /not found/);
  assert.throws(() => resolveTime('soon', c), /bad time/);
});

test('buildTimeline: shots tile the timeline, cues pin to words', () => {
  const tl = buildTimeline(mk(), null, { props }), [s1, s2] = tl.shots, w = (n) => s1.words.find((x) => x.n === n);
  assert.equal(s1.start, 0); assert.equal(s1.end, s2.start); assert.equal(s2.end, tl.duration);
  assert.equal(s1.layers[1].start, w('kong').start); assert.equal(s1.layers[1].end, w('hands').start);
  assert.equal(s1.layers[0].end, s1.end); assert.equal(s1.layers[1].explicitEnd, true);
  assert.equal(tl.sfx[0].t, w('hong').start);
  assert.equal(tl.transitions.length, 1); assert.equal(tl.transitions[0].boundary, s1.end);
  assert.equal(shotAt(tl, 0.01).index, 0); assert.equal(shotAt(tl, s2.start + 0.01).index, 1); assert.equal(shotAt(tl, 999).index, 1);
});

test('captions: chunks + token timing via say mapping', () => {
  const tl = buildTimeline(mk(), null, { props }), w = tl.shots[0].words, ch = tl.captions;
  assert.equal(ch.filter((c) => c.line === 'l1').length, 2);
  const c0 = ch[0], tok = c0.tokens[1];
  assert.equal(tok.text, '1997'); assert.equal(tok.em, true);
  assert.equal(tok.start, w[1].start); assert.equal(tok.end, w[2].end);
  assert.ok(Math.abs(c0.start - (w[0].start - 0.05)) < 1e-9);
  assert.equal(ch[0].end, ch[1].start);
  for (let i = 1; i < ch.length; i++) assert.ok(ch[i].start >= ch[i - 1].end - 1e-9 || ch[i].line !== ch[i - 1].line);
});

test('buildTimeline throws on bad scripts (never drifts)', () => {
  let s = mk(); s.shots[0].layers[1].at = 'word:handover';
  assert.throws(() => buildTimeline(s, null, { props }), /not found/);
  s = mk(); s.shots.push({ line: 'l1', layers: [] });
  assert.throws(() => buildTimeline(s, null, { props }), /span/);
  s = mk(); s.shots[0].layers[0].prop = 'nope';
  assert.throws(() => buildTimeline(s, null, { props }), /unknown prop/);
  s = mk(); s.shots[1].layers.push({ prop: 'solidBg', at: 'word:hong' });
  assert.throws(() => buildTimeline(s, null, { props }), /not found|outside/);
});
