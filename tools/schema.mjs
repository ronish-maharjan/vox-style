#!/usr/bin/env node
// schema — JSON Schema for the script format and every prop (PR2). Generated from the prop
// registry, so it can never drift from CATALOG.md or validate. Feed it to any AI with
// structured-output / function-calling support to get valid scripts by construction.
// Usage: npm run schema -- [--script] [--prop <name>] [--out <dir>] [--check <project>]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { discoverProps, toDefs, ROOT } from '../lib/registry.mjs';
import { propSchema, scriptSchema, SCHEMA_VERSION } from './lib/schema.mjs';
import { schemaCheck } from './lib/schema-check.mjs';

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    script: { type: 'boolean' },
    prop: { type: 'string' },
    out: { type: 'string' },
    check: { type: 'string' },
  },
});

const { props, problems } = await discoverProps({});
const defs = toDefs(props);

if (problems.length) {
  console.error('✖ prop registry problems:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if (flags.check) {
  const file = path.join(ROOT, 'projects', flags.check, 'script.json');
  if (!fs.existsSync(file)) { console.error(`✖ ${path.relative(ROOT, file)} not found`); process.exit(2); }
  const script = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errs = schemaCheck(scriptSchema(defs), script);
  if (errs.length) {
    console.error(`✖ ${errs.length} schema error(s) in ${flags.check}/script.json:`);
    errs.forEach((e) => console.error(`  - ${e.path}: ${e.message}`));
    process.exit(1);
  }
  console.log(`✔ ${flags.check}/script.json matches the script schema (v${SCHEMA_VERSION}, ${Object.keys(defs).length} props)`);
  process.exit(0);
}

if (flags.prop) {
  const def = defs[flags.prop];
  if (!def) { console.error(`✖ unknown prop "${flags.prop}". Known: ${Object.keys(defs).join(', ')}`); process.exit(2); }
  console.log(JSON.stringify(propSchema(def), null, 2));
  process.exit(0);
}

if (flags.out) {
  const dir = path.resolve(flags.out);
  fs.mkdirSync(path.join(dir, 'props'), { recursive: true });
  const s = scriptSchema(defs);
  fs.writeFileSync(path.join(dir, 'script.schema.json'), JSON.stringify(s, null, 2) + '\n');
  for (const [name, def] of Object.entries(defs)) {
    fs.writeFileSync(path.join(dir, 'props', `${name}.schema.json`), JSON.stringify(propSchema(def), null, 2) + '\n');
  }
  console.log(`✔ wrote ${dir}/script.schema.json + ${Object.keys(defs).length} prop schemas (v${SCHEMA_VERSION})`);
  process.exit(0);
}

// default: print the script schema
console.log(JSON.stringify(scriptSchema(defs), null, 2));
