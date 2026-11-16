// tools/catalog.mjs — generate CATALOG.md from every prop's meta (+ recipes).
// Usage: npm run catalog [-- --project <p>] [--example <project>] [--strict]
//   no flags       -> CATALOG.md (kit props)
//   --project hk   -> projects/hk/CATALOG.md (kit + that project's local props)

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { discoverProps, toDefs, ROOT } from '../lib/registry.mjs';
import { normSpec } from './lib/types.mjs';
import { checkPropMeta, validateRecipe } from './validate.mjs';

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const first = (s) => String(s ?? '').trim().split(/(?<=[.!?])\s/)[0];
const code = (s) => `\`${esc(s)}\``;

function specRows(bag, withDefault) {
  const rows = Object.entries(bag ?? {}).map(([k, v]) => [k, normSpec(v)]);
  if (!rows.length) return ['_None._'];
  const head = withDefault ? ['| Name | Type | Default | Notes |', '|---|---|---|---|'] : ['| Name | Type | Notes |', '|---|---|---|'];
  return [...head, ...rows.map(([k, s]) => withDefault
    ? `| ${code(k)} | ${code(s.type)} | ${s.default === undefined ? '—' : code(JSON.stringify(s.default))} | ${esc(s.doc ?? '')} |`
    : `| ${code(k)} | ${code(s.type)} | ${esc(s.doc ?? '')} |`)];
}

function propSection(e) {
  const m = e.def.meta;
  const ex = { prop: m.name, slots: m.example?.slots ?? {}, options: m.example?.options ?? {}, at: 'start' };
  const facts = [`default duration ${m.defaultDuration}s`];
  if (m.space) facts.push(`space: ${m.space}`);
  if (m.depth !== undefined) facts.push(`default depth: ${m.depth}`);
  return [
    `#### ${m.name}`, '',
    `**Use:** ${m.use}`, '',
    `**Do not:** ${m.avoid}`, '',
    `_${facts.join(' · ')}_${e.source === 'project' ? ' · project-local prop' : ''}`, '',
    '**Slots** (content):', '', ...specRows(m.slots, false), '',
    '**Options:**', '', ...specRows(m.options, true), '',
    '**Example layer:**', '', '```json', JSON.stringify(ex), '```', '',
  ];
}

/** Pure: returns { md, unavailable[] }. Deterministic (no timestamps). */
export function buildCatalog({ header = '', example = null, entries, recipes = [] }) {
  const sorted = [...entries].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const have = new Set(sorted.map((e) => e.name));
  const L = [header.trim(), ''];

  if (example) L.push('## Complete working example', '', 'A valid script from this repo. Copy its structure.', '', '```json', JSON.stringify(example, null, 2), '```', '');

  L.push('## Choosing props', '', 'Pick by purpose; details are in the reference below.', '',
    '| Need | Prop | Category | Do not |', '|---|---|---|---|',
    ...sorted.map((e) => `| ${esc(first(e.def.meta.use))} | ${code(e.name)} | ${esc(e.category)} | ${esc(first(e.def.meta.avoid))} |`), '');

  L.push('## Reference', '', 'A `?` after a type means optional. Slots are content; options are look and placement.', '');
  let cat = null;
  for (const e of sorted) {
    if (e.category !== cat) { cat = e.category; L.push(`### ${cat}`, ''); }
    L.push(...propSection(e));
  }

  const unavailable = [];
  const usable = [];
  for (const r of recipes) {
    const need = [...(r.shot?.layers ?? []).map((l) => l.prop), r.shot?.transition?.type].filter(Boolean);
    const missing = need.filter((n) => !have.has(n));
    if (missing.length) unavailable.push({ name: r.name, missing });
    else usable.push(r);
  }
  if (usable.length) {
    L.push('## Recipes', '', 'Ready-made shot bundles. Copy the snippet into a shot and replace every `{{param}}`.', '');
    for (const r of usable) {
      L.push(`### ${r.name}`, '', `**Use:** ${r.use}`, '');
      const params = Object.entries(r.params ?? {});
      if (params.length) L.push('**Params:**', '', ...params.map(([k, v]) => `- ${code(`{{${k}}}`)} — ${v}`), '');
      L.push('```json', JSON.stringify(r.shot, null, 2), '```', '');
    }
  }
  return { md: L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', unavailable };
}

function loadRecipes(root) {
  const dir = path.join(root, 'recipes');
  const recipes = [], problems = [];
  if (!fs.existsSync(dir)) return { recipes, problems };
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json') && !n.startsWith('_')).sort()) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!r.name || !r.use || !r.shot) throw new Error('needs name, use, shot');
      recipes.push(r);
    } catch (e) { problems.push(`recipes/${f}: ${e.message}`); }
  }
  return { recipes, problems };
}

async function main() {
  const args = process.argv.slice(2);
  const val = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  const project = val('--project');
  const exampleProject = val('--example') ?? 'demo';
  try { execFileSync(process.execPath, [path.join(ROOT, 'tools/scan-props.mjs')], { cwd: ROOT, stdio: 'pipe' }); } catch { /* optional */ }

  const { props, problems } = await discoverProps({ project });
  for (const e of props.values()) for (const p of checkPropMeta(e.def)) problems.push(`${e.name}: ${p}`);

  const { recipes, problems: rp } = loadRecipes(ROOT);
  problems.push(...rp);
  const defs = toDefs(props);
  for (const r of recipes) {
    const v = validateRecipe(r, defs);
    if (!v.missing.length) v.errors.forEach((m) => problems.push(`recipe ${r.name}: ${m}`));
  }

  const headerFile = path.join(ROOT, 'tools/catalog.header.md');
  const header = fs.existsSync(headerFile) ? fs.readFileSync(headerFile, 'utf8') : '# Catalog\n';
  const exFile = path.join(ROOT, 'projects', exampleProject, 'script.json');
  const example = fs.existsSync(exFile) ? JSON.parse(fs.readFileSync(exFile, 'utf8')) : null;

  const { md, unavailable } = buildCatalog({ header, example, entries: [...props.values()], recipes });
  const out = project ? path.join(ROOT, 'projects', project, 'CATALOG.md') : path.join(ROOT, 'CATALOG.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md);

  const cats = new Set([...props.values()].map((e) => e.category));
  console.log(`wrote ${path.relative(ROOT, out)} — ${props.size} prop(s) in ${cats.size} categor${cats.size === 1 ? 'y' : 'ies'}, ${recipes.length - unavailable.length} recipe(s)`);
  for (const u of unavailable) console.log(`  recipe "${u.name}" hidden: needs ${u.missing.join(', ')}`);
  if (problems.length) {
    console.log(`\n⚠ ${problems.length} problem(s):`);
    problems.forEach((p) => console.log(`  - ${p}`));
    if (args.includes('--strict')) process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
