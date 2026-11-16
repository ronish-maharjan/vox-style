// tools/new-prop.mjs — scaffold a prop from props/_template, then rescan.
// Usage: npm run new-prop -- <category>/<name>              (kit prop)
//        npm run new-prop -- <name> --project <project>     (project-local prop)

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { discoverProps, ROOT } from '../lib/registry.mjs';

const args = process.argv.slice(2);
const pi = args.indexOf('--project');
const project = pi >= 0 ? args[pi + 1] : null;
const target = args.find((a, i) => !a.startsWith('--') && (pi < 0 || i !== pi + 1));
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };

if (!target) die('usage: npm run new-prop -- <category>/<name>  |  <name> --project <project>');
if (pi >= 0 && !project) die('--project needs a project name');

let category = null, name = target;
if (target.includes('/')) [category, name] = target.split('/');
if (!project && !category) die('kit props need a category, e.g. new-prop -- photos/polaroid');
if (project && category) die('project-local props take just a name (no category)');
if (!/^[a-z][A-Za-z0-9]*$/.test(name)) die(`name "${name}" must be camelCase (letters/digits, starting lowercase)`);
if (category && !/^[a-z][a-z0-9-]*$/.test(category)) die(`category "${category}" must be lowercase-with-dashes`);

const tpl = path.join(ROOT, 'props/_template/index.js');
if (!fs.existsSync(tpl)) die('props/_template/index.js not found');

const { props } = await discoverProps({ project });
if (props.has(name)) die(`a prop named "${name}" already exists (${path.relative(ROOT, props.get(name).dir)}); prop names are global`);

const dir = project ? path.join(ROOT, 'projects', project, 'props', name) : path.join(ROOT, 'props', category, name);
if (fs.existsSync(dir)) die(`${path.relative(ROOT, dir)} already exists`);
const rel = path.relative(ROOT, path.join(dir, 'index.js')).split(path.sep).join('/');

const swap = (src, key, value) => {
  let hit = false;
  const out = src.replace(new RegExp(`(\\b${key}:\\s*)(['"\`])[^'"\`]*\\2`), (_, a, q) => { hit = true; return `${a}${q}${value}${q}`; });
  return [out, hit];
};
let src = fs.readFileSync(tpl, 'utf8').replace(/props\/_template\/index\.js/g, rel);
let ok;
[src, ok] = swap(src, 'name', name);
if (!ok) console.log('⚠ could not find meta.name in the template — set it by hand (must equal the folder name)');
if (category) [src] = swap(src, 'category', category);

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.js'), src);
console.log(`✔ created ${rel}`);

try { execFileSync(process.execPath, [path.join(ROOT, 'tools/scan-props.mjs')], { cwd: ROOT, stdio: 'inherit' }); }
catch { console.log('⚠ scan failed; run npm run scan after editing'); }

console.log(`\nNext:
  1. Fill in meta (use, avoid, slots, options, example) and draw() in ${rel}
  2. npm run catalog${project ? ` -- --project ${project}` : ''}   (shows meta problems)
  3. npm run validate -- <project>`);
