#!/usr/bin/env node
// video — the ONE command. intent/script -> validate -> audio -> align -> draft -> QA -> final MP4.
// Designed for AI agents and humans who don't want to memorise the pipeline:
//
//   npm run video -- <project>                     # full auto: draft + final
//   npm run video -- <project> --draft-only        # stop after the draft + report
//   npm run video -- <project> --from-intent       # compile intent.json first (if present)
//   npm run video -- <project> --strict-audio      # require real audio (human or TTS)
//   npm run video -- <project> --no-tts            # never synthesise; estimated timings
//
// Audio policy (never blocks on a human by default):
//   1. existing audio/ files (narration.wav|mp3|m4a or per-line l1.wav …)
//   2. Piper TTS if a voice is available (npm run speak)
//   3. estimated timings + a clear warning (--strict-audio turns this into an error)
// Alignment: Whisper when faster-whisper is installed, else the TTS/estimated timings.
// Status: machine-readable projects/<p>/build/video.status.json after every stage,
// so an agent can resume or inspect exactly where a run stopped.
//
// Exit codes: 0 ok · 1 failed · 2 usage

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/pyenv.mjs';

const { values: f, positionals: [name] } = parseArgs({
  allowPositionals: true,
  options: {
    'draft-only': { type: 'boolean' },
    'from-intent': { type: 'boolean' },
    'strict-audio': { type: 'boolean' },
    'no-tts': { type: 'boolean' },
    aspect: { type: 'string' },
    voice: { type: 'string' },
    workers: { type: 'string' },
    final: { type: 'boolean' },      // inverse of --draft-only (default when unset)
  },
});

if (!name) {
  console.error('usage: npm run video -- <project> [--draft-only] [--from-intent] [--strict-audio] [--no-tts] [--aspect 16:9] [--voice <piper-onnx>]');
  process.exit(2);
}

const dir = path.join(ROOT, 'projects', name);
const buildDir = path.join(dir, 'build');
const statusPath = path.join(buildDir, 'video.status.json');
const tool = (t, args = []) => spawnSync(process.execPath, [path.join(ROOT, 'tools', t), ...args], { stdio: 'inherit', cwd: ROOT }).status === 0;
const audioDir = path.join(dir, 'audio');

fs.mkdirSync(buildDir, { recursive: true });
const status = fs.existsSync(statusPath) ? JSON.parse(fs.readFileSync(statusPath, 'utf8')) : { project: name, stages: {} };
status.project = name;
status.startedAt = new Date().toISOString();
const save = () => { fs.writeFileSync(statusPath, JSON.stringify(status, null, 2)); };
const stage = (id, run) => {
  console.log(`\n── ${id} ` + '─'.repeat(Math.max(0, 66 - id.length)));
  const ok = run();
  status.stages[id] = { ok, at: new Date().toISOString() };
  save();
  if (!ok) {
    status.finishedAt = new Date().toISOString(); save();
    console.error(`\n✖ stage "${id}" failed — fix and re-run (stages resume); status: ${path.relative(ROOT, statusPath)}`);
    process.exit(1);
  }
  return true;
};

// ── 1. script (compile from intent if asked / if intent.json exists and script.json doesn't)
const scriptPath = path.join(dir, 'script.json');
const intentPath = path.join(dir, 'intent.json');
if ((f['from-intent'] || !fs.existsSync(scriptPath)) && fs.existsSync(intentPath)) {
  stage('compile', () => tool('compile.mjs', [name]));
} else if (!fs.existsSync(scriptPath)) {
  console.error(`✖ projects/${name}/script.json not found (and no intent.json to compile). Write one — see CATALOG.md.`);
  process.exit(1);
}

// ── 2. validate
stage('validate', () => tool('validate.mjs', [name, ...(f.aspect ? ['--aspect', f.aspect] : []), '--draft']));

// ── 3. audio: existing > TTS > estimated
const hasAudio = fs.existsSync(audioDir) && fs.readdirSync(audioDir).some((x) => /\.(wav|mp3|m4a)$/i.test(x));
let audioMode = 'none';
if (hasAudio) {
  audioMode = 'existing';
  console.log(`\n── audio: using existing files in projects/${name}/audio/`);
} else if (!f['no-tts']) {
  console.log('\n── audio: none found — trying local TTS (Piper)');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/speak.mjs'), name, ...(f.voice ? ['--voice', f.voice] : [])], { encoding: 'utf8', cwd: ROOT });
  if (r.status === 0) {
    audioMode = 'tts';
    console.log('  ✔ TTS narration written');
  } else if (r.status === 2 || r.status === 3) {
    const why = String(r.stderr || '').split('\n').find((l) => l.includes('✖')) || 'unavailable';
    console.log(`  (TTS unavailable: ${why.replace('✖ ', '').split('.').slice(0, 1)}.} — continuing with estimated timings; install with: npm run setup:audio)`);
  } else {
    audioMode = 'none';
    console.error(`  ✖ TTS failed:\n${String(r.stderr || r.stdout || '').split('\n').slice(0, 6).join('\n')}`);
  }
}
if (audioMode === 'none' && f['strict-audio']) {
  console.error('\n✖ --strict-audio set and no audio available (record narration, or install piper: npm run setup:audio)');
  process.exit(1);
}
status.audio = audioMode;
save();

// ── 4. align (only meaningful with real audio; whisper optional)
if (audioMode !== 'none') {
  console.log('\n── align: word timings (Whisper if available)');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/align.mjs'), name], { stdio: 'inherit', cwd: ROOT });
  status.stages.align = { ok: r.status === 0, at: new Date().toISOString() };
  save();
  if (r.status !== 0) {
    console.log('  (align unavailable — word cues resolve against estimated timings)');
  }
} else {
  console.log('\n── align: skipped (no audio; estimated timings)');
}

// ── 5. draft render
stage('draft', () => tool('make.mjs', [name, '--draft', ...(f.aspect ? ['--aspect', f.aspect] : []), ...(f.workers ? ['--workers', f.workers] : [])]));

// ── 6. QA: human sheets + machine-readable report
stage('qa', () => tool('qa.mjs', [name]));
console.log('\n── analyze (machine-readable)');
const an = spawnSync(process.execPath, [path.join(ROOT, 'tools/analyze.mjs'), name, '--json'], { encoding: 'utf8', cwd: ROOT, maxBuffer: 1 << 26 });
let report = null;
try { report = JSON.parse(an.stdout); } catch { /* analyzed best-effort */ }
if (report) {
  status.qa = report;
  save();
  if (report.flags?.length) {
    console.log(`  ⚠ ${report.flags.length} flag(s): ${report.flags.map((x) => `shot ${x.shot}: ${x.flags.join('/')}`).join('; ')}`);
    for (const s of (report.suggestions || []).slice(0, 5)) console.log(`  → ${s}`);
  } else {
    console.log('  ✔ no QA flags');
  }
}

// ── 7. final render unless --draft-only
if (!f['draft-only']) {
  stage('final', () => tool('make.mjs', [name, ...(f.aspect ? ['--aspect', f.aspect] : []), ...(f.workers ? ['--workers', f.workers] : [])]));
  const out = path.join(dir, 'out.mp4');
  if (fs.existsSync(out)) {
    const mb = (fs.statSync(out).size / 1e6).toFixed(1);
    console.log(`\n✔ ${path.relative(ROOT, out)}  (${mb} MB, ${report ? report.duration + 's' : ''})`);
    status.output = path.relative(ROOT, out);
  }
} else {
  console.log(`\n✔ draft done: projects/${name}/out.draft.mp4  (final render skipped: --draft-only)`);
}

status.finishedAt = new Date().toISOString();
status.ok = true;
save();
console.log(`status: ${path.relative(ROOT, statusPath)}`);
