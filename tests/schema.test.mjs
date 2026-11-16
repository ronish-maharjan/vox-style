// tests/schema.test.mjs — the JSON Schema pipeline self-check (PR2): every prop generates
// a coherent schema, the script schema covers every prop, and the real project scripts
// pass schemaCheck (a planted error must be caught).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scan, loadProps, ROOT } from '../tools/scan-props.mjs';
import { propSchema, layerSchema, scriptSchema, SCHEMA_VERSION } from '../tools/lib/schema.mjs';
import { schemaCheck } from '../tools/lib/schema-check.mjs';

let defs = null;
test.before(async () => {
  await scan();
  defs = await loadProps('test10'); // kit props + any test10-local props
});

test('schema: every prop generates a schema with required slots declared', () => {
  for (const [n, def] of Object.entries(defs)) {
    const s = propSchema(def);
    assert.equal(s.$schema, 'https://json-schema.org/draft/2020-12/schema', n);
    const slots = s.properties.slots;
    for (const k of slots.required ?? []) {
      assert.ok(k in slots.properties, `${n}: required slot "${k}" not in properties`);
    }
    const opts = s.properties.options;
    assert.deepEqual(opts.required ?? [], [], `${n}: options must never be required`);
    for (const u of ['x', 'y', 'w', 'h', 'rot', 'scale', 'opacity', 'pad']) {
      assert.ok(u in opts.properties, `${n}: universal option "${u}" missing`);
    }
  }
});

test('schema: layer schema discriminates on every prop name', () => {
  const ls = layerSchema(defs);
  const names = Object.keys(defs);
  assert.equal(ls.allOf.length, names.length);
  const consts = ls.allOf.map((b) => b.if.properties.prop.const).sort();
  assert.deepEqual(consts, [...names].sort());
  assert.deepEqual(ls.properties.prop.enum.slice().sort(), [...names].sort());
});

test('schema: real project scripts pass schemaCheck; a planted error is caught', async () => {
  const schema = scriptSchema(defs);
  assert.equal(schema.properties.schemaVersion.const, SCHEMA_VERSION);
  for (const p of ['demo', 'hk1997', 'test10']) {
    const f = path.join(ROOT, 'projects', p, 'script.json');
    try { await fs.access(f); } catch { continue; }
    const script = JSON.parse(await fs.readFile(f, 'utf8'));
    const errs = schemaCheck(schema, script);
    assert.deepEqual(errs, [], `${p}: ${errs.map((e) => `${e.path}: ${e.message}`).join(' | ')}`);
  }

  const bad = JSON.parse(await fs.readFile(path.join(ROOT, 'projects', 'test10', 'script.json'), 'utf8'));
  bad.shots[0].sfx = [{ type: 'explosion' }];
  bad.shots[0].layers[0].prop = 'paperBgg';
  const errs = schemaCheck(schema, bad);
  assert.ok(errs.some((e) => /explosion/.test(e.message)), 'unknown sfx type not caught');
  assert.ok(errs.some((e) => /paperBgg/.test(e.message) && e.path.endsWith('.prop')), 'unknown prop not caught');
});
