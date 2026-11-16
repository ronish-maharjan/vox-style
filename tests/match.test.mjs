import test from 'node:test';
import assert from 'node:assert/strict';
import { spokenWords, alignTokens, syllables } from '../tools/lib/match.mjs';
import { cueRefs, resolveCueToken, parseCue } from '../tools/lib/cues.mjs';

const hw = (w, start, end, p = 0.9) => ({ w, start, end, p });

test('number expansion', () => {
  assert.deepEqual(spokenWords('1997'), ['nineteen', 'ninety', 'seven']);
  assert.deepEqual(spokenWords('156,'), ['one', 'hundred', 'fifty', 'six']);
  assert.deepEqual(spokenWords('2007'), ['two', 'thousand', 'seven']);
  assert.deepEqual(spokenWords('1905'), ['nineteen', 'oh', 'five']);
  assert.deepEqual(spokenWords('3.5%'), ['three', 'point', 'five', 'percent']);
  assert.deepEqual(spokenWords('1st'), ['first']);
  assert.deepEqual(spokenWords('ninety-seven'), ['ninety', 'seven']);
  assert.deepEqual(spokenWords("Don't"), ['dont']);
  assert.deepEqual(spokenWords('Kong,'), ['kong']);
  assert.equal(syllables('handover') >= 2, true);
});

test('"1997" in script matches "nineteen ninety-seven" from Whisper', () => {
  const r = alignTokens(['In', '1997', 'Britain', 'left'], [
    hw('In', 0, 0.2), hw('nineteen', 0.2, 0.5), hw('ninety-seven', 0.5, 1.0), hw('Britain', 1.0, 1.4), hw('left', 1.4, 1.7),
  ]);
  assert.equal(r.tokens[1].start, 0.2);
  assert.ok(Math.abs(r.tokens[1].end - 1.0) < 1e-9);
  assert.ok(r.tokens[1].conf > 0.8);
  assert.equal(r.inserted.length, 0);
});

test('digits from Whisper also match', () => {
  const r = alignTokens(['In', '1997', 'Britain'], [hw('In', 0, 0.2), hw('1997.', 0.2, 1.0), hw('Britain', 1.0, 1.4)]);
  assert.ok(r.tokens[1].conf > 0.8);
});

test('unheard words are interpolated and flagged', () => {
  const r = alignTokens(['alpha', 'bravo', 'charlie'], [hw('alpha', 0, 0.5), hw('charlie', 1, 1.5)]);
  assert.equal(r.tokens[1].hit, 0);
  assert.equal(r.tokens[1].guessed, true);
  assert.equal(r.tokens[1].conf, 0);
  assert.ok(r.tokens[1].start >= 0.5 - 1e-9 && r.tokens[1].end <= 1 + 1e-9);
});

test('fuzzy match tolerates a misspelled name; extras are reported as inserted', () => {
  const r = alignTokens(['Deng', 'Xiaoping', 'agreed'], [hw('Deng', 0, 0.3), hw('Shaoping', 0.3, 0.9), hw('uh', 0.9, 1.0), hw('agreed', 1.0, 1.5)]);
  assert.ok(r.tokens[1].hit === 1);
  assert.deepEqual(r.inserted.map((x) => x.w), ['uh']);
});

test('times are monotonic', () => {
  const r = alignTokens(['one', 'two', 'three', 'four'], [hw('two', 1, 1.4), hw('three', 1.4, 1.8)]);
  for (let i = 1; i < r.tokens.length; i++) assert.ok(r.tokens[i].start >= r.tokens[i - 1].start);
});

test('cue parsing and gate lookup', () => {
  assert.deepEqual(parseCue('word:kong'), { word: 'kong', nth: 1 });
  assert.deepEqual(parseCue('word:the#2'), { word: 'the', nth: 2 });
  assert.deepEqual(parseCue('word:kong+0.2s'), { word: 'kong', nth: 1 });
  assert.equal(parseCue('start'), null);
  const refs = cueRefs({ shots: [{ id: 's1', line: 'l1', layers: [{ at: 'word:kong' }] }, { line: 'l2', camera: { at: 'end' } }] });
  assert.equal(refs.length, 1);
  assert.equal(refs[0].line, 'l1');
  assert.equal(resolveCueToken(['Hong', 'Kong,', '1997'], { word: 'kong', nth: 1 }), 1);
  assert.equal(resolveCueToken(['the', 'a', 'the'], { word: 'the', nth: 2 }), 2);
  assert.equal(resolveCueToken(['a'], { word: 'zzz', nth: 1 }), -1);
});
