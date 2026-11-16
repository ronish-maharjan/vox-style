#!/usr/bin/env node
// bin/vox.mjs — the one entry point. `vox <command>` runs the matching tool with
// passthrough args; `vox` / `vox help` prints the command map.
// npm scripts stay for compatibility; this is the discoverable hub.

const COMMANDS = [
  ['video', 'make a video start-to-finish: compile → validate → audio(TTS) → align → draft → QA → final', 'tools/video.mjs'],
  ['compile', 'intent.json → script.json (recipes + auto cue words + spans)', 'tools/compile.mjs'],
  ['validate', 'check a script against the prop catalog (the authority)', 'tools/validate.mjs'],
  ['catalog', 'regenerate CATALOG.md from prop metadata', 'tools/catalog.mjs'],
  ['slots', 'print one prop\'s slots/options/example', 'tools/slots.mjs'],
  ['make', 'render (uses cached steps): sfx → mix → capture', 'tools/make.mjs'],
  ['capture', 'render frames to MP4 directly (parallel workers)', 'tools/capture.mjs'],
  ['qa', 'contact sheets + shot frames + report (look at them!)', 'tools/qa.mjs'],
  ['analyze', 'machine-readable QA report (flags + suggestions)', 'tools/analyze.mjs'],
  ['frame', 'grab one frame as PNG', 'mcp/../tools/qa.mjs'],
  ['watch', 're-validate + re-draft on every save', 'tools/watch.mjs'],
  ['export', 'write narration.txt for recording', 'tools/export.mjs'],
  ['speak', 'local TTS narration (Piper; presets: narrator|news|warm|documentary)', 'tools/speak.mjs'],
  ['align', 'Whisper word timings → words.json (gate on bad cues)', 'tools/align.mjs'],
  ['sfx', 'sound design events for a project', 'tools/sfx.mjs'],
  ['mix', 'mix narration + sfx + music', 'tools/mix.mjs'],
  ['subtitles', 'SRT/VTT export from word timings', 'tools/subtitles.mjs'],
  ['thumbnail', 'cover image (+ optional title overlay)', 'tools/thumbnail.mjs'],
  ['preview', 'local scrubber page for a project', 'tools/preview.mjs'],
  ['new-prop', 'scaffold a new prop folder', 'tools/new-prop.mjs'],
  ['brief', 'generate BRIEF.md for a chat AI to write a script', 'tools/brief.mjs'],
  ['brief-prop', 'generate PROP_BRIEF.md for a chat AI to write a prop', 'tools/brief-prop.mjs'],
  ['schema', 'JSON Schema of scripts (structured-output tools)', 'tools/schema.mjs'],
  ['doctor', 'environment health check', 'tools/doctor.mjs'],
  ['bench', 'render performance benchmark', 'tools/bench.mjs'],
  ['test', 'run the test suite', null],
  // setup & internals
  ['setup', 'fonts + map data (one-time, needs internet)', 'tools/setup.mjs'],
  ['setup:audio', 'python + whisper model + narrator voice', 'tools/setup-audio.mjs'],
  ['setup:geo', 'map data only', 'tools/setup-geo.mjs'],
  ['bundle', 'everything setup needs, offline afterwards', 'tools/bundle.mjs'],
  ['pack', 'portable tarball of the studio', 'tools/pack.mjs'],
  ['mcp', 'MCP server on stdio (tool-calling AI clients)', 'mcp/server.mjs'],
];

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [, , cmd, ...args] = process.argv;

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  const groups = { 'make a video': ['video', 'compile', 'validate', 'make', 'capture', 'qa', 'analyze', 'watch', 'preview'], 'audio': ['export', 'speak', 'align', 'sfx', 'mix'], 'publish': ['subtitles', 'thumbnail'], 'build props': ['new-prop', 'brief', 'brief-prop', 'catalog', 'slots', 'schema'], 'diagnose': ['doctor', 'bench', 'test'], 'install / ship': ['setup', 'setup:audio', 'setup:geo', 'bundle', 'pack', 'mcp'] };
  console.log('vox — paper-craft video studio\n');
  for (const [g, cmds] of Object.entries(groups)) {
    console.log(g.toUpperCase());
    for (const c of cmds) {
      const hit = COMMANDS.find((x) => x[0] === c);
      console.log(`  ${hit[0].padEnd(13)} ${hit[1]}`);
    }
    console.log('');
  }
  console.log('start here: vox video <project> --from-intent   (or: npm run video -- <project>)');
  process.exit(0);
}

const hit = COMMANDS.find((x) => x[0] === cmd);
if (!hit) {
  console.error(`unknown command "${cmd}". Run "vox help" for the list.`);
  process.exit(2);
}

if (hit[0] === 'test') {
  const r = spawnSync(process.execPath, ['--test'], { stdio: 'inherit', cwd: ROOT });
  process.exit(r.status ?? 1);
}
if (hit[0] === 'frame') {
  // thin alias: vox frame <project> <seconds> -> mcp-style frame via ffmpeg not needed; reuse qa's grabber
  const [project, time] = args;
  if (!project || time === undefined) { console.error('usage: vox frame <project> <seconds>'); process.exit(2); }
  const video = path.join(ROOT, 'projects', project, fs.existsSync(path.join(ROOT, 'projects', project, 'out.mp4')) ? 'out.mp4' : 'out.draft.mp4');
  if (!fs.existsSync(video)) { console.error('no render found — run vox video first'); process.exit(1); }
  const dest = path.join(ROOT, 'projects', project, 'qa', `frame-${String(time).replace('.', '_')}s.png`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = spawnSync(path.join(ROOT, 'node_modules/ffmpeg-static/ffmpeg'), ['-y', '-v', 'error', '-ss', String(time), '-i', video, '-frames:v', '1', dest], { stdio: 'inherit' });
  if (r.status === 0) console.log(`✔ ${path.relative(ROOT, dest)}`);
  process.exit(r.status ?? 1);
}

const r = spawnSync(process.execPath, [path.join(ROOT, hit[2]), ...args], { stdio: 'inherit', cwd: ROOT });
process.exit(r.status ?? 1);
