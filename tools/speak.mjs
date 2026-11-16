#!/usr/bin/env node
// speak — local text-to-speech narration via Piper. Writes projects/<p>/audio/<lineId>.wav
// for every line, so `npm run align -- <p>` then works exactly as with human-recorded audio.
// The pipeline stop "the human records narration" is optional.
//
// Usage: npm run speak -- <project> [--voice <path|preset>] [--dry-run] [--force]
//   --voice   a .onnx voice path, a preset (narrator|news|warm|documentary), or a bare
//             voice name resolved from voices/ or the project dir
//             (fallback order: --voice > projects/<p>/voice.onnx > voices/*.onnx > $PIPER_VOICE)
//   --dry-run print the plan without synthesising
//   --force   re-synthesise lines whose wav already exists
//
// Install (one time): npm run setup:audio  (python venv + whisper model + narrator voice)
// Exit codes: 0 ok · 2 piper not installed · 3 no voice found · 4 synthesis failed.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/pyenv.mjs';

const { values: flags, positionals: [name] } = parseArgs({
  allowPositionals: true,
  options: {
    voice: { type: 'string' },
    'dry-run': { type: 'boolean' },
    force: { type: 'boolean' },
  },
});

if (!name) {
  console.error('usage: npm run speak -- <project> [--voice <path|name>] [--dry-run] [--force]');
  process.exit(2);
}

const dir = path.join(ROOT, 'projects', name);
const scriptF = path.join(dir, 'script.json');

if (!fs.existsSync(scriptF)) {
  console.error(`✖ projects/${name}/script.json not found`);
  process.exit(2);
}

const script = JSON.parse(fs.readFileSync(scriptF, 'utf8'));
const lines = script.lines ?? [];

if (!lines.length) {
  console.error(`✖ projects/${name}/script.json has no lines`);
  process.exit(2);
}

// ── resolve the voice ─────────────────────────────────────────
// Presets (P0.4): a short name that maps to a known-good Piper voice. The .onnx
// (and its .json) are downloaded by `npm run setup:audio` into voices/; a preset
// resolves only when the file exists locally — nothing is fetched here.
export const VOICE_PRESETS = {
  narrator: 'en_US-amy-medium',     // warm female narrator (default)
  news: 'en_GB-alan-medium',        // male, broadcast
  warm: 'en_US-lessac-medium',      // neutral warm
  documentary: 'en_GB-northern_english_male-medium',
};

function findVoice() {
  if (flags.voice) {
    const preset = VOICE_PRESETS[flags.voice];
    if (preset) {
      const p = ['voices', ''].map((d) => path.join(ROOT, d, `${preset}.onnx`)).find(fs.existsSync);
      if (p) return path.resolve(p);
      return null; // preset named but not downloaded: run npm run setup:audio
    }
    const v = path.extname(flags.voice) === '.onnx' || fs.existsSync(flags.voice)
      ? flags.voice
      : ['voices', ''].map((d) => path.join(ROOT, d, `${flags.voice}.onnx`)).find(fs.existsSync);
    if (v && fs.existsSync(v)) return path.resolve(v);
    return null; // an explicit --voice that cannot be found is an error, not a fallback
  }
  const project = path.join(dir, 'voice.onnx');
  if (fs.existsSync(project)) return project;
  const voicesDir = path.join(ROOT, 'voices');
  if (fs.existsSync(voicesDir)) {
    const hit = fs.readdirSync(voicesDir).find((x) => x.endsWith('.onnx'));
    if (hit) return path.join(voicesDir, hit);
  }
  if (process.env.PIPER_VOICE && fs.existsSync(process.env.PIPER_VOICE)) return process.env.PIPER_VOICE;
  return null;
}

// ── resolve piper ──────────────────────────────────────────────
function findPiper() {
  for (const bin of ['piper', path.join(ROOT, 'vendor', 'piper', 'piper')]) {
    try {
      const r = spawnSync(bin, ['--help'], { stdio: 'pipe', timeout: 8000 });
      if (!r.error && r.status === 0) return bin;
    } catch { /* keep looking */ }
  }
  return null;
}

const dry = flags['dry-run'] === true;
const audioDir = path.join(dir, 'audio');
const voice = findVoice();

console.log(`speak ${name} — ${lines.length} line(s), voice: ${voice ? path.relative(ROOT, voice) : '(none found)'}`);

if (dry) {
  lines.forEach((L) => console.log(`  would synth ${L.id}.wav: "${(L.say ?? L.text).slice(0, 60)}"`));
  console.log('  then run: npm run align -- ' + name);
  process.exit(0);
}

if (!voice) {
  const presetHint = flags.voice && VOICE_PRESETS[flags.voice]
    ? `\n   The "${flags.voice}" preset (${VOICE_PRESETS[flags.voice]}) is not downloaded yet: npm run setup:audio`
    : '';
  console.error(`✖ no Piper voice found. Put one .onnx (plus its .onnx.json) in voices/, or projects/${name}/voice.onnx, or pass --voice <path|preset>.${presetHint}\n   Presets: ${Object.keys(VOICE_PRESETS).join(', ')} · Voices: https://github.com/rhasspy/piper/blob/master/VOICES.md`);
  process.exit(3);
}

const piper = findPiper();

if (!piper) {
  console.error(`✖ piper not found on PATH (or ${path.join('vendor', 'piper', 'piper')}).\n   Install: pip install piper-tts   (or download a release), then re-run.`);
  process.exit(2);
}

fs.mkdirSync(audioDir, { recursive: true });

let failed = 0;
for (const L of lines) {
  const text = String(L.say ?? L.text).trim();
  const out = path.join(audioDir, `${L.id}.wav`);

  if (!flags.force && fs.existsSync(out)) {
    console.log(`  ↷ ${L.id}.wav exists (use --force to redo)`);
    continue;
  }

  const r = spawnSync(piper, ['--model', voice, '--output_file', out], {
    input: text + '\n', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120000,
  });

  if (r.status === 0 && fs.existsSync(out) && fs.statSync(out).size > 0) {
    console.log(`  ✔ ${L.id}.wav  "${text.slice(0, 50)}${text.length > 50 ? '…' : ''}"`);
  } else {
    failed++;
    console.error(`  ✖ ${L.id}: piper exit ${r.status}${r.stderr ? '\n    ' + String(r.stderr).trim().split('\n').slice(-3).join('\n    ') : ''}`);
  }
}

if (failed) {
  console.error(`\n✖ ${failed}/${lines.length} line(s) failed`);
  process.exit(4);
}

console.log(`\n✔ ${lines.length} wav file(s) in projects/${name}/audio/`);
console.log(`  next: npm run align -- ${name}   # word timings (Whisper), then npm run make -- ${name}`);
