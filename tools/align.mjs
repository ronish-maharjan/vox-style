#!/usr/bin/env node
// align — Whisper word timestamps → projects/<p>/words.json (+ build/narration.wav)
// Usage: npm run align -- <project> [--model small.en] [--force] [--allow-low]
import './lib/bins.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { ROOT, pyHas, runPy } from './lib/pyenv.mjs';
import { toWav, readWav, writeMono16, silence, RATE } from './lib/wav.mjs';
import { alignTokens, estimateSeconds } from './lib/match.mjs';
import { cueRefs, resolveCueToken } from './lib/cues.mjs';
import { loadAlignConfig } from './lib/audio-config.mjs';
import { audioFiles, stem } from './lib/audio-files.mjs';

const die = (m) => { console.error('✖ ' + m); process.exit(1); };
const { values: flags, positionals: [name] } = parseArgs({
  allowPositionals: true,
  options: { model: { type: 'string' }, force: { type: 'boolean' }, 'allow-low': { type: 'boolean' } },
});
if (!name) die('usage: npm run align -- <project>');

const dir = path.join(ROOT, 'projects', name);
const build = path.join(dir, 'build');
fs.mkdirSync(path.join(build, 'audio'), { recursive: true });
const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
const cfg = loadAlignConfig(ROOT);
if (flags.model) cfg.model = flags.model;

const lines = (script.lines || [])
  .map((l) => ({ id: l.id, spoken: String(l.say ?? l.text ?? '').trim() }))
  .filter((l) => l.spoken)
  .map((l) => ({ ...l, tokens: l.spoken.split(/\s+/) }));
if (!lines.length) die('script has no spoken lines');

// ── find audio ────────────────────────────────────────────────────────────
const files = audioFiles(dir);
if (!files.length) die(`no audio in projects/${name}/audio/ — run: npm run export -- ${name}`);
const byId = new Map(files.map((f) => [stem(f), f]));
const have = lines.filter((l) => byId.has(l.id));
let mode;
if (have.length === lines.length) mode = 'lines';
else if (have.length > 0) die(`per-line mode needs a file for EVERY line. Missing: ${lines.filter((l) => !byId.has(l.id)).map((l) => l.id).join(', ')}`);
else mode = 'single';

const audioDir = path.join(dir, 'audio');
const wavFor = (src, dstName) => {
  const dst = path.join(build, 'audio', dstName + '.wav'), s = path.join(audioDir, src);
  if (!fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(s).mtimeMs) toWav(s, dst);
  return dst;
};
let items;
const allText = lines.map((l) => l.spoken).join(' ');
const prompt = (t) => (cfg.usePrompt ? t.slice(0, 800) : '');
if (mode === 'lines') {
  items = lines.map((l) => ({ line: l, wav: wavFor(byId.get(l.id), l.id), prompt: prompt(l.spoken) }));
} else {
  const f = files.find((x) => stem(x).toLowerCase() === 'narration') ?? (files.length === 1 ? files[0] : null);
  if (!f) die(`several audio files and none is named narration.* — found: ${files.join(', ')}`);
  items = [{ wav: wavFor(f, 'narration-src'), prompt: prompt(allText) }];
}
console.log(`Mode: ${mode === 'lines' ? 'one file per line' : 'single narration file'} · model ${cfg.model}`);

// ── transcribe (cached per file) ──────────────────────────────────────────
const cachePath = path.join(build, 'transcripts.json');
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
for (const it of items) {
  const s = fs.statSync(it.wav);
  it.key = crypto.createHash('sha1').update([cfg.model, cfg.beam, s.size, Math.round(s.mtimeMs), it.prompt].join('|')).digest('hex');
}
const todo = items.filter((it) => flags.force || !cache[it.key]);
if (todo.length) {
  const modelDir = path.join(ROOT, 'models', 'whisper', cfg.model);
  if (!fs.existsSync(path.join(modelDir, 'model.bin'))) die(`Whisper model missing: ${modelDir}\n  run: npm run setup:audio`);
  if (!pyHas(['faster_whisper'])) die('faster-whisper not installed. run: npm run setup:audio');
  const jobs = path.join(build, 'jobs.json'), outp = path.join(build, 'jobs.out.json');
  fs.writeFileSync(jobs, JSON.stringify(todo.map((it) => ({ audio: it.wav, prompt: it.prompt }))));
  console.log(`Transcribing ${todo.length} file(s) …`);
  const code = runPy('transcribe.py', ['--model-dir', modelDir, '--jobs', jobs, '--out', outp, '--device', cfg.device, '--compute', cfg.computeType, '--beam', String(cfg.beam), ...(cfg.language ? ['--language', String(cfg.language)] : [])]);
  if (code) die('transcription failed (see above)');
  JSON.parse(fs.readFileSync(outp, 'utf8')).forEach((r, i) => { cache[todo[i].key] = { words: r.words }; });
  fs.writeFileSync(cachePath, JSON.stringify(cache));
} else console.log('Transcripts cached — skipping Whisper.');
for (const it of items) { it.words = cache[it.key].words; it.pcm = readWav(it.wav); }

// ── align + assemble narration.wav ────────────────────────────────────────
const parts = [silence(cfg.lead)];
let bytes = parts[0].length;
const push = (b) => { parts.push(b); bytes += b.length; };
const now = () => bytes / 2 / RATE;
const shift = (r, off) => ({
  tokens: r.tokens.map((t) => ({ ...t, start: t.start + off, end: t.end + off })),
  inserted: r.inserted.map((t) => ({ ...t, start: t.start + off, end: t.end + off })),
});
const results = [];
let globalInserted = [];
if (mode === 'lines') {
  items.forEach((it, i) => {
    const off = now();
    const r = alignTokens(it.line.tokens, it.words, { lo: 0, hi: it.pcm.seconds });
    results.push({ id: it.line.id, off, dur: it.pcm.seconds, ...shift(r, off) });
    push(it.pcm.data);
    if (i < items.length - 1) push(silence(cfg.lineGap));
  });
} else {
  const it = items[0];
  const r = shift(alignTokens(lines.flatMap((l) => l.tokens), it.words, { lo: 0, hi: it.pcm.seconds }), cfg.lead);
  push(it.pcm.data);
  let k = 0;
  for (const l of lines) {
    results.push({ id: l.id, off: cfg.lead, dur: it.pcm.seconds, tokens: r.tokens.slice(k, k + l.tokens.length), inserted: [] });
    k += l.tokens.length;
  }
  globalInserted = r.inserted;
}
push(silence(cfg.tail));
writeMono16(path.join(build, 'narration.wav'), parts);

// ── report ────────────────────────────────────────────────────────────────
const pct = (x) => Math.round(x * 100) + '%';
let nWarn = 0;
const W = (m) => { nWarn++; console.log('         ⚠ ' + m); };
console.log('');
results.forEach((L, li) => {
  const T = L.tokens;
  L.conf = T.reduce((a, t) => a + t.conf, 0) / T.length;
  const s = T[0].start, e = T[T.length - 1].end;
  const icon = L.conf >= 0.85 ? '✔' : L.conf >= cfg.minLineConfidence ? '⚠' : '✖';
  console.log(`  ${L.id.padEnd(6)} ${icon} ${pct(L.conf).padStart(4)}  ${T.length} words  ${s.toFixed(2)} → ${e.toFixed(2)}s`);
  const miss = T.filter((t) => t.hit === 0 && t.units > 0).map((t) => `"${t.raw}"`);
  if (miss.length) W(`not heard: ${miss.join(', ')}`);
  if (L.conf < cfg.minLineConfidence) W('low confidence — script text and audio probably differ here');
  for (let i = 1; i < T.length; i++) {
    if (!T[i].guessed && !T[i - 1].guessed && T[i].start - T[i - 1].end > cfg.maxGap)
      W(`${(T[i].start - T[i - 1].end).toFixed(1)}s silence after "${T[i - 1].raw}" (at ${T[i - 1].end.toFixed(1)}s)`);
  }
  if (mode === 'lines') {
    if (!T[0].guessed && T[0].start - L.off > cfg.maxGap) W(`${(T[0].start - L.off).toFixed(1)}s of silence before the first word — trim the file`);
    if (!T.at(-1).guessed && L.off + L.dur - e > cfg.maxGap) W(`${(L.off + L.dur - e).toFixed(1)}s of silence after the last word — trim the file`);
    if (L.inserted.length >= 3) W(`extra words heard: ${L.inserted.slice(0, 6).map((t) => t.w).join(' ')}`);
  } else if (li > 0) {
    const prev = results[li - 1].tokens.at(-1);
    if (!prev.guessed && !T[0].guessed && s - prev.end > 1.5) W(`${(s - prev.end).toFixed(1)}s pause before this line`);
  }
  const exp = estimateSeconds(T.map((t) => t.raw).join(' ')), act = e - s;
  if (T.length >= 3 && (act / exp < 0.55 || act / exp > 2))
    W(`spoken in ${act.toFixed(1)}s but the text suggests ~${exp.toFixed(1)}s — extra/missing words, or very slow/fast read`);
});
if (globalInserted.length >= 3)
  W(`${globalInserted.length} words heard that are not in the script, e.g. ${globalInserted.slice(0, 8).map((t) => `"${t.w}"@${t.start.toFixed(1)}s`).join(' ')}`);

// ── cue gate ──────────────────────────────────────────────────────────────
const bad = [];
for (const r of cueRefs(script)) {
  const L = results.find((x) => x.id === r.line);
  if (!L) { bad.push(`${r.raw} (shot ${r.shot}): shot has no resolvable "line"`); continue; }
  const idx = resolveCueToken(L.tokens.map((t) => t.raw), r);
  if (idx < 0) { bad.push(`${r.raw} (shot ${r.shot}): word not in line ${L.id}'s spoken text`); continue; }
  const t = L.tokens[idx];
  if (t.hit === 0 || t.conf < cfg.cueMinConfidence)
    bad.push(`${r.raw} (shot ${r.shot}, line ${L.id}): "${t.raw}" ${t.hit === 0 ? 'was not heard' : 'heard with only ' + pct(t.conf) + ' confidence'}`);
}

const r3 = (x) => Math.round(x * 1000) / 1000;
const wordsJson = {
  lines: results.map((L) => ({
    id: L.id, start: r3(L.tokens[0].start), end: r3(L.tokens.at(-1).end),
    words: L.tokens.map((t) => ({ w: t.raw, start: r3(t.start), end: r3(t.end) })),
  })),
};
fs.writeFileSync(path.join(build, 'words.draft.json'), JSON.stringify(wordsJson, null, 1));
fs.writeFileSync(path.join(build, 'align-report.json'), JSON.stringify(results.map((L) => ({ id: L.id, conf: r3(L.conf), words: L.tokens.length })), null, 1));

console.log('');
if (bad.length && !flags['allow-low']) {
  console.log('✖ Cue gate — these cue words are not reliably in the audio:');
  bad.forEach((b) => console.log('   • ' + b));
  console.log('\n  Fix the script wording (or re-record the line) and re-run align.');
  console.log('  Inspect: projects/' + name + '/build/words.draft.json   Override: --allow-low');
  process.exit(1);
}
if (bad.length) bad.forEach((b) => console.log('  ⚠ (allowed) ' + b));
fs.writeFileSync(path.join(dir, 'words.json'), JSON.stringify(wordsJson, null, 1));
console.log(`✔ projects/${name}/words.json  (${nWarn} warning${nWarn === 1 ? '' : 's'}) · build/narration.wav ${now().toFixed(1)}s`);
console.log(`  next: npm run make -- ${name} --draft\n`);
