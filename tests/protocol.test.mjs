import test from 'node:test';
import assert from 'node:assert/strict';
import { parseType, checkType, assertPropShape } from '../core/protocol.js';
import solidBg from "../props/backgrounds/solidBg/index.js"
import template from '../props/_template/index.js';

test('checkType', () => {
  assert.equal(checkType('range:0..1', 0.5), null); assert.match(checkType('range:0..1', 2), /0\.\.1/);
  assert.equal(checkType('string?', undefined), null); assert.match(checkType('string', undefined), /required/);
  assert.equal(checkType('length', '50%'), null); assert.equal(checkType('length', { portrait: '50%', landscape: 100 }), null);
  assert.match(checkType('length', 'abc'), /px/); assert.equal(checkType('enum:a|b', 'a'), null); assert.match(checkType('enum:a|b', 'c'), /a\|b/);
  assert.throws(() => parseType('banana'));
});

test('prop shape', () => {
  assert.ok(assertPropShape(solidBg, 'solidBg')); assert.ok(assertPropShape(template, 'template'));
  assert.throws(() => assertPropShape({ meta: { name: 'x' } }, 'x'), /meta\.use/);
});
