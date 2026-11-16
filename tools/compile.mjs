#!/usr/bin/env node
// compile — turn a simple INTENT file into a full script.json.
// The "weak AI" front door: instead of hand-writing shots, layers, pixel geometry and
// cue words, an AI (or human) writes one short intent file and the compiler expands
// named recipes into fully-styled, validated shots.
//
// Usage: npm run compile -- <project>                     (reads projects/<p>/intent.json)
//        node tools/compile.mjs --in intent.json --out script.json [--dry-run]
//
// intent.json shape (everything is optional except lines):
//   {
//     "meta":  { "title": "...", "aspect": "9:16" },
//     "lines": [
//       { "id": "l1", "text": "For 156 years, Hong Kong was a British colony.",
//         "say": "For one hundred fifty-six years ...",        // optional pronunciation
//         "caps": "For *156* years,|Hong Kong ...",           // optional caption control
//         "shots": [
//           { "recipe": "stat-reveal", "params": { "value": "156", "label": "years of British rule" } },
//           { "recipe": "verdict-stamp", "params": { "src": "handover.jpg", "caption": "1997",
//                                                    "text": "SIGNED" } }
//         ]
//       }
//     ]
//   }
// - A line with ONE shot may omit the "shots" array wrapper: { "recipe": ..., "params": ... }
// - A line with NO shots gets a neutral solidBg shot (the video still validates).
// - "raw" shots (normal script shot objects) may be mixed with recipes.
// - cueWord params are auto-picked from the line's spoken text when omitted:
//   distinctive content words only (no stopwords, no repeated words, not the line's
//   only-just-used cue), earliest good word wins, so visuals land early.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { ROOT, discoverProps } from '../lib/registry.mjs';
import { validateScript } from './validate.mjs';

const RECIPES_DIR = path.join(ROOT, 'recipes');

// English function words a cue should never be (extends naturally; lowercase, no punctuation).
const STOPWORDS = new Set(('a an the this that these those and or but if then than so because of to in on at for from by with without into over under ' +
  'is are was were be been being am do does did have has had having will would can could should shall may might must ' +
  'it its it\'s they them their there here we our you your i me my he she his her ' +
  'as not no nor very just also too more most some any each other another such only own same s t don now ' +
  'up down out off about against between through during before after above below again further once').split(/\s+/));

function loadRecipes(dir = RECIPES_DIR) {
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (r && r.name && r.shot) out.set(r.name, r);
    } catch { /* skip broken recipe files; catalog/validate report them separately */ }
  }
  return out;
}

/**
 * Distinctive spoken words of a line, best first: content words, unique, long, early.
 * opts.range: [from, to] word-index bounds (inclusive) — use for span pivots so the
 * chosen word is guaranteed INSIDE the sub-shot it belongs to.
 */
export function pickCueWords(line, taken = new Set(), opts = {}) {
  const spoken = String(line.say ?? line.text ?? '');
  const words = spoken.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, '')).filter(Boolean);
  const counts = new Map(words.map((w) => [w, 0]));
  for (const w of words) counts.set(w, counts.get(w) + 1);
  const [lo, hi] = opts.range || [0, words.length - 1];
  const good = words
    .map((w, i) => ({ w, i }))
    .filter(({ w, i }) => {
      const k = w.toLowerCase().replace(/'/g, '');
      return i >= lo && i <= hi && !STOPWORDS.has(k) && w.length >= 3 && counts.get(w) === 1 && !taken.has(k);
    });
  // prefer earlier + longer + digits (numbers/years are the strongest cue words:
  // distinctive, always spoken, and the aligner matches them reliably)
  const score = (w, i) => w.length * 2 - i * 0.5 + (/\d/.test(w) ? 6 : 0);
  return good
    .map(({ w, i }) => ({ w, i, s: score(w, i) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => ({ word: x.w.toLowerCase().replace(/'/g, ''), index: x.i }));
}

/** {{param}} substitution that keeps JSON types when the whole string is one placeholder. */
function substitute(value, params) {
  if (typeof value === 'string') {
    const whole = /^\s*\{\{(\w+)\}\}\s*$/.exec(value);
    if (whole) {
      const v = params[whole[1]];
      return v === undefined ? value : v;                     // "0" from params stays a string; numbers pass through
    }
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => (params[k] === undefined ? `{{${k}}}` : String(params[k])));
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, params));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, params)]));
  }
  return value;
}

/** Expand one intent shot {recipe, params} | raw shot into a script shot. Returns [shot, issues[]]. */
export function expandShot(intentShot, { recipes, line, takenCues, shotIndex, props, wordRange = null }) {
  const issues = [];
  let shot;
  if (typeof intentShot.recipe === 'string') {
    const r = recipes.get(intentShot.recipe);
    if (!r) {
      return [null, [`unknown recipe "${intentShot.recipe}". Known: ${[...recipes.keys()].join(', ') || '(none)'}`]];
    }
    const params = { ...(intentShot.params || {}) };
    // auto-pick cue words the recipe expects but the caller did not give.
    // wordRange keeps the cue INSIDE this sub-shot of a split line.
    const words = String(line.say ?? line.text ?? '').split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, '')).filter(Boolean);
    const range = wordRange && words.length
      ? [Math.min(words.length - 1, Math.round((words.length * wordRange[0]) / wordRange[2])), Math.max(0, Math.ceil((words.length * wordRange[1]) / wordRange[2]) - 1)]
      : null;
    for (const k of Object.keys(r.params || {})) {
      if (params[k] === undefined && /^cue(word)?$/i.test(k)) {
        const cue = pickCueWords(line, takenCues, range ? { range } : {})[0];
        if (cue) { params[k] = cue.word; takenCues.add(cue.word); }
        else issues.push(`recipe "${r.name}": no distinctive cue word left in line "${line.id}" for param "${k}"`);
      }
    }
    shot = JSON.parse(JSON.stringify(r.shot));                // deep copy, placeholders intact
    shot = substitute(shot, params);
    const missing = JSON.stringify(shot).match(/\{\{(\w+)\}\}/g) || [];
    if (missing.length) issues.push(`recipe "${r.name}": unfilled param(s) ${[...new Set(missing)].join(', ')} in line "${line.id}"`);
    shot.line = line.id;
  } else if (intentShot && typeof intentShot === 'object' && (intentShot.layers || intentShot.camera)) {
    shot = { ...intentShot, line: line.id };                  // raw pass-through
  } else {
    return [null, [`shot ${shotIndex} of line "${line.id}" needs "recipe" or raw {layers}`]];
  }
  if (intentShot.transition) shot.transition = intentShot.transition;
  if (shotIndex > 0 && !shot.span && !shot.transition) shot.transition = shot.transition || { type: 'wipe' };
  return [shot, issues];
}

/** intent -> script. Throws Error with a joined message list on structural problems. */
export function compileIntent(intent, { recipes = loadRecipes() } = {}) {
  if (!intent || typeof intent !== 'object') throw new Error('intent must be a JSON object');
  if (!Array.isArray(intent.lines) || !intent.lines.length) throw new Error('intent.lines must be a non-empty array');

  const script = { meta: { title: intent.meta?.title || 'Untitled', aspect: intent.meta?.aspect || '9:16' } };
  if (intent.assets && Object.keys(intent.assets).length) script.assets = intent.assets;

  const outLines = [], outShots = [];
  const issues = [];
  const seenIds = new Set();

  intent.lines.forEach((L, i) => {
    const id = L.id || `l${i + 1}`;
    if (seenIds.has(id)) issues.push(`duplicate line id "${id}"`);
    seenIds.add(id);
    const line = { id, text: L.text };
    if (L.say) line.say = L.say;
    if (L.caps !== undefined) line.caps = L.caps;
    if (typeof line.text !== 'string' || !line.text.trim()) {
      issues.push(`lines[${i}] (${id}): "text" is required`);
      line.text = line.text || '';
    }
    outLines.push(line);

    // shots: "shots" array | single {recipe,...} | nothing (neutral default)
    let wants = L.shots;
    if (!wants && (L.recipe || L.layers)) wants = [L];
    if (!wants) wants = [{ layers: [{ prop: 'solidBg' }] }];   // keeps the video valid; validate will warn EMPTY-ish

    const takenCues = new Set();
    const multi = wants.length > 1;
    wants.forEach((s, j) => {
      // sub-shot j of a multi-shot line covers word indices [j/n, (j+1)/n) of the line
      const wordRange = multi ? [j, j + 1, wants.length] : null;
      const [shot, probs] = expandShot(s, { recipes, line, takenCues, shotIndex: j, props: null, wordRange });
      issues.push(...probs);
      if (!shot) return;
      outShots.push(shot);
    });
  });

  // spans + in-shot cues: multi-shot lines split across the line's word range.
  // Pivots are position-bounded so every word: cue lands INSIDE its own sub-shot.
  const wordList = (L) => String(L.say ?? L.text ?? '').split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, '')).filter(Boolean);
  const byLine = new Map();
  outShots.forEach((s) => { if (!byLine.has(s.line)) byLine.set(s.line, []); byLine.get(s.line).push(s); });
  for (const [id, arr] of byLine) {
    if (arr.length < 2) { arr.forEach((s) => delete s.span); continue; }
    const L = intent.lines.find((x) => (x.id || `l${intent.lines.indexOf(x) + 1}`) === id);
    const words = L ? wordList(L) : [];
    const n = arr.length;
    const pivots = [];
    for (let j = 1; j < n; j++) {
      // boundary j sits at word ~ (j/n) through the line; allow 15% slack either side
      const target = Math.round((words.length * j) / n);
      const slack = Math.max(1, Math.round(words.length * 0.15));
      const range = [Math.max(0, target - slack), Math.min(words.length - 1, target + slack)];
      const cue = (L && pickCueWords(L, new Set(), { range })[0]) || null;
      const pivot = cue?.word ?? words[Math.min(words.length - 1, target)]?.toLowerCase();
      if (pivot) pivots.push({ j, pivot });
    }
    if (pivots.length === n - 1) {
      arr.forEach((s, j) => {
        const from = j === 0 ? 'start' : `word:${pivots.find((p) => p.j === j).pivot}`;
        const to = j === n - 1 ? 'end' : `word:${pivots.find((p) => p.j === j + 1).pivot}`;
        s.span = [from, to];
      });
    } else {
      arr.forEach((s) => { s.span = ['start', 'end']; });
    }
  }

  if (issues.length) throw new Error(issues.map((s) => `- ${s}`).join('\n'));
  script.lines = outLines;
  script.shots = outShots;
  return script;
}

// ── CLI ──
const { values: f, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    in: { type: 'string' }, out: { type: 'string' }, 'dry-run': { type: 'boolean' }, force: { type: 'boolean' },
  },
});

async function main() {
  const project = positionals[0];
  const inFile = f.in || (project && path.join(ROOT, 'projects', project, 'intent.json'));
  const outFile = f.out || (project && path.join(ROOT, 'projects', project, 'script.json'));
  if (!inFile || !outFile) {
    console.error('usage: npm run compile -- <project>   |   node tools/compile.mjs --in intent.json --out script.json [--dry-run]');
    process.exit(2);
  }
  if (!fs.existsSync(inFile)) { console.error(`✖ intent file not found: ${inFile}`); process.exit(1); }
  if (fs.existsSync(outFile) && !f.force && !f['dry-run'] && !project) {
    console.error(`✖ refusing to overwrite ${outFile} (use --force)`); process.exit(1);
  }

  let intent;
  try { intent = JSON.parse(fs.readFileSync(inFile, 'utf8')); }
  catch (e) { console.error(`✖ intent is not valid JSON: ${e.message}`); process.exit(1); }

  const recipes = loadRecipes();
  let script;
  try { script = compileIntent(intent, { recipes }); }
  catch (e) { console.error(`✖ intent does not compile:\n${e.message}`); process.exit(1); }

  // validate against the real prop registry before writing anything
  const { props } = await discoverProps({ root: ROOT, project: project || null });
  const defs = Object.fromEntries([...props].map(([k, v]) => [k, v.def]));
  const res = validateScript({
    script, props: defs, aspect: script.meta.aspect,
    assetExists: () => true, allowMissingAssets: true,
  });
  const errs = res.errors.filter((e) => !/asset .* not found/.test(e));
  if (errs.length) {
    console.error(`✖ compiled script does not validate (fix the intent):\n${errs.map((e) => `- ${e}`).join('\n')}`);
    process.exit(1);
  }

  if (f['dry-run']) { console.log(JSON.stringify(script, null, 2)); }
  else {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(script, null, 2) + '\n');
    console.log(`✔ ${path.relative(ROOT, outFile)}  (${script.lines.length} lines, ${script.shots.length} shots)${res.warnings.length ? `  ⚠ ${res.warnings.length} warning(s)` : ''}`);
  }
  for (const w of res.warnings) console.log(`  ⚠ ${w}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) main();
