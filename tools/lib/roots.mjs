// Where things live. STUDIO_ROOT = this package (code + kit props). WORKSPACE = the user's folder
// (projects, assets, own props, recipes, fonts, models). Today they are the SAME folder.
// To split: set VOX_WORKSPACE=/path, or put an empty vox.workspace.json in a folder and run from inside it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function findWorkspace() {
  if (process.env.VOX_WORKSPACE) return path.resolve(process.env.VOX_WORKSPACE);
  let d = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(d, 'vox.workspace.json'))) return d;
    const up = path.dirname(d);
    if (up === d) return STUDIO_ROOT;
    d = up;
  }
}
export const WORKSPACE = findWorkspace();
export const isSplit = WORKSPACE !== STUDIO_ROOT;
export const studioPath = (...p) => path.join(STUDIO_ROOT, ...p);
export const workspacePath = (...p) => path.join(WORKSPACE, ...p);
export const projectDir = (name) => workspacePath('projects', name);
