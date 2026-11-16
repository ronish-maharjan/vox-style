// lib/registry.mjs — find and import every prop (kit + optional project-local).
// Usage: const { props, problems } = await discoverProps({ project: 'hk' })

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function findPropDirs(dir, depth = 0) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (fs.existsSync(path.join(full, 'index.js'))) out.push(full);
    else if (depth < 2) out.push(...findPropDirs(full, depth + 1));
  }
  return out;
}

/** Map name -> { name, def, dir, source: 'kit'|'project', category, overrides? } */
export async function discoverProps({ root = ROOT, project = null } = {}) {
  const props = new Map();
  const problems = [];
  const sources = [{ dir: path.join(root, 'props'), source: 'kit' }];
  if (project) sources.push({ dir: path.join(root, 'projects', project, 'props'), source: 'project' });

  for (const { dir, source } of sources) {
    for (const d of findPropDirs(dir)) {
      const rel = path.relative(root, d);
      try {
        const mod = await import(pathToFileURL(path.join(d, 'index.js')).href);
        const def = mod.default;
        if (!def || !def.meta || typeof def.draw !== 'function') {
          problems.push(`${rel}: default export must be { meta, draw }`);
          continue;
        }
        const folder = path.basename(d);
        const name = def.meta.name ?? folder;
        if (name !== folder) problems.push(`${rel}: folder name must equal meta.name ("${name}")`);
        const parent = path.basename(path.dirname(d));
        const category = def.meta.category ?? (parent === 'props' ? (source === 'project' ? 'project' : 'misc') : parent);
        props.set(name, { name, def, dir: d, source, category, overrides: props.has(name) });
      } catch (e) {
        problems.push(`${rel}: failed to import — ${e.message}`);
      }
    }
  }
  return { props, problems };
}

export const toDefs = (props) => Object.fromEntries([...props].map(([k, v]) => [k, v.def]));
