// Python resolution: vendor/venv first, then system python. Usage: runPy('transcribe.py', [...args])
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VENV = path.join(ROOT, 'vendor', 'venv');
const win = process.platform === 'win32';
export const venvPython = () => path.join(VENV, win ? 'Scripts' : 'bin', win ? 'python.exe' : 'python');

export function systemPython() {
  for (const c of ['python3', 'python']) {
    if (spawnSync(c, ['--version'], { stdio: 'ignore' }).status === 0) return c;
  }
  return null;
}
export const pythonBin = () => (fs.existsSync(venvPython()) ? venvPython() : systemPython());

export function pyHas(mods) {
  const py = pythonBin();
  if (!py) return false;
  return spawnSync(py, ['-c', mods.map((m) => `import ${m}`).join(';')], { stdio: 'ignore' }).status === 0;
}

export function runPy(script, args = []) {
  const py = pythonBin();
  if (!py) throw new Error('Python not found. Install Python 3.9+ then run: npm run setup:audio');
  const r = spawnSync(py, [path.join(ROOT, 'tools', 'py', script), ...args], { stdio: 'inherit', cwd: ROOT });
  return r.status ?? 1;
}
