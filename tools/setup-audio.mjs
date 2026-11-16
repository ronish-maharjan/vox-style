#!/usr/bin/env node
// setup-audio — one-time: Python venv (numpy, scipy, faster-whisper) + Whisper model → models/whisper/<model>/
// Usage: npm run setup:audio [-- --model small.en] [--download-wheels]
// Offline afterwards. If vendor/wheels/ exists, packages install from it with no network.
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT, VENV, venvPython, systemPython, pyHas } from './lib/pyenv.mjs';
import { loadAlignConfig, DEFAULTS } from './lib/audio-config.mjs';

const { values: flags } = parseArgs({ options: { model: { type: 'string' }, 'download-wheels': { type: 'boolean' }, 'no-voice': { type: 'boolean' } } });
const die = (m) => { console.error('✖ ' + m); process.exit(1); };
const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT }).status === 0;
const PKGS = ['numpy', 'scipy', 'faster-whisper'];

// 1 — venv
if (!fs.existsSync(venvPython())) {
  const py = systemPython();
  if (!py) die('Python 3.9+ not found. Arch: sudo pacman -S python · Debian/Ubuntu: sudo apt install python3 python3-venv · macOS: brew install python');
  console.log('Creating venv …');
  if (!run(py, ['-m', 'venv', VENV])) die('venv creation failed (Debian/Ubuntu: sudo apt install python3-venv)');
}
const vpy = venvPython();
const wheels = path.join(ROOT, 'vendor', 'wheels');

// 2 — packages
if (flags['download-wheels']) {
  fs.mkdirSync(wheels, { recursive: true });
  console.log('Downloading wheels into vendor/wheels …');
  if (!run(vpy, ['-m', 'pip', 'download', '--disable-pip-version-check', '-d', wheels, ...PKGS])) die('pip download failed');
}
if (!pyHas(['numpy', 'scipy', 'faster_whisper'])) {
  const offline = fs.existsSync(wheels) && fs.readdirSync(wheels).length > 0;
  console.log(offline ? 'Installing from vendor/wheels (offline) …' : 'Installing Python packages …');
  const args = ['-m', 'pip', 'install', '--disable-pip-version-check', ...(offline ? ['--no-index', '--find-links', wheels] : []), ...PKGS];
  if (!run(vpy, args)) die('pip install failed');
}
if (!pyHas(['numpy', 'scipy', 'faster_whisper'])) die('Python packages still missing after install');
console.log('✔ python packages');

// 3 — config
const cfgFile = path.join(ROOT, 'align.config.json');
if (!fs.existsSync(cfgFile)) { fs.writeFileSync(cfgFile, JSON.stringify(DEFAULTS, null, 2) + '\n'); console.log('✔ wrote align.config.json'); }
const model = flags.model ?? loadAlignConfig(ROOT).model;

// 4 — model
const mdir = path.join(ROOT, 'models', 'whisper', model);
fs.mkdirSync(mdir, { recursive: true });
const base = `https://huggingface.co/Systran/faster-whisper-${model}/resolve/main/`;
const mb = (n) => (n / 1e6).toFixed(0);

async function download(file) {
  const dest = path.join(mdir, file), tmp = dest + '.part';
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return true;
  const have = fs.existsSync(tmp) ? fs.statSync(tmp).size : 0;
  const res = await fetch(base + file, { headers: have ? { Range: `bytes=${have}-` } : {}, redirect: 'follow' });
  if (res.status === 404) return false;
  if (res.status === 416) { fs.renameSync(tmp, dest); return true; }
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const append = res.status === 206;
  const total = (append ? have : 0) + Number(res.headers.get('content-length') || 0);
  const out = fs.createWriteStream(tmp, { flags: append ? 'a' : 'w' });
  let got = append ? have : 0;
  for await (const chunk of res.body) {
    if (!out.write(chunk)) await once(out, 'drain');
    got += chunk.length;
    process.stdout.write(`\r  ${file} ${mb(got)}/${mb(total)} MB   `);
  }
  out.end(); await once(out, 'finish');
  process.stdout.write('\n');
  fs.renameSync(tmp, dest);
  return true;
}

console.log(`Whisper model ${model} → models/whisper/${model}/`);
try {
  for (const f of ['config.json', 'tokenizer.json', 'model.bin']) if (!(await download(f))) die(`${f} not found at ${base}`);
  if (!(await download('vocabulary.txt'))) await download('vocabulary.json');
} catch (e) { die(`${e.message}\n  (re-run to resume; or download the files manually into ${mdir})`); }
console.log('✔ model ready');

// 5 — default narrator voice (Piper, P0.4): voices/<preset>.onnx(+.json)
// Small (~60 MB total), from the official Piper release; skipped when piper-tts
// is not wanted or the voice already exists. --no-voice opts out.
if (flags['no-voice']) {
  console.log('(voice download skipped: --no-voice)');
} else {
  const { VOICE_PRESETS } = await import('./speak.mjs').catch(() => ({}));
  const preset = VOICE_PRESETS?.narrator;
  if (!preset) {
    console.log('(voice presets unavailable — speak.mjs could not be imported)');
  } else {
    const vdir = path.join(ROOT, 'voices');
    fs.mkdirSync(vdir, { recursive: true });
    const PIPER_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/';
    const files = [
      [`${preset}.onnx`, `${PIPER_BASE}${preset.split('-')[1].toLowerCase()}/${preset}.onnx`],
      [`${preset}.onnx.json`, `${PIPER_BASE}${preset.split('-')[1].toLowerCase()}/${preset}.onnx.json`],
    ];
    let ok = true;
    for (const [file, url] of files) {
      const dest = path.join(vdir, file);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { console.log(`✔ voices/${file} (cached)`); continue; }
      try {
        console.log(`downloading voices/${file} …`);
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(dest, buf);
        console.log(`✔ voices/${file} (${(buf.length / 1e6).toFixed(0)} MB)`);
      } catch (e) {
        ok = false;
        console.log(`  ⚠ ${file}: ${e.message} — TTS will be unavailable; piper voices: https://github.com/rhasspy/piper/blob/master/VOICES.md`);
        break;
      }
    }
    if (ok) console.log('✔ narrator voice ready');
  }
}

console.log('everything is local now.\n  next: npm run video -- <project>   (one command, start to finish)');
