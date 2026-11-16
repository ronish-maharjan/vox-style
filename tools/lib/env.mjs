// tools/lib/env.mjs — locate ffmpeg / Chrome / Python, read studio.config.json.
// Usage: const ff = findFfmpeg(); const cfg = readConfig();
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { ROOT } from '../../lib/registry.mjs';
export { ROOT };

const exe = process.platform === 'win32' ? '.exe' : '';
const runs = (cmd, args) => { try { return spawnSync(cmd, args, { encoding: 'utf8' }).status === 0; } catch { return false; } };

export function findFfmpeg() {
  const c = [process.env.FFMPEG_PATH, path.join(ROOT, 'vendor', 'ffmpeg', `ffmpeg${exe}`)];
  try { c.push(createRequire(import.meta.url)('ffmpeg-static')); } catch { /* optional */ }
  c.push('ffmpeg');
  return c.find((x) => x && runs(x, ['-version'])) ?? null;
}

export function hasEncoder(ffmpeg, name) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.includes(name);
}

export function findChrome() {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
  return c.find((x) => x && fs.existsSync(x)) ?? null;
}

export const findPython = () => ['python3', 'python'].find((p) => runs(p, ['--version'])) ?? null;
export const pyHas = (py, mods) => runs(py, ['-c', `import ${mods}`]);

const CFG = path.join(ROOT, 'studio.config.json');
export const readConfig = () => { try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch { return {}; } };
export const writeConfig = (c) => fs.writeFileSync(CFG, JSON.stringify(c, null, 2) + '\n');
