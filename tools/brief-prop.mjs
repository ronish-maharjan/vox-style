// tools/brief-prop.mjs — bundle everything a chat AI needs to write ONE working prop.
// Usage: npm run brief:prop -- [--like stamp,paperPhoto] [--request my-request.md] [--out PROP_BRIEF.md]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const abs = (p) => path.join(ROOT, p);
const readIf = (p) => (fs.existsSync(abs(p)) ? fs.readFileSync(abs(p), 'utf8') : null);

/** Verbatim file in a fenced block (fence longer than any backtick run inside). */
function fenced(label, p, maxLines) {
  const txt = readIf(p);
  if (txt === null) return `### ${label}\n\n_(${p} not found in this repo)_\n`;
  const lines = txt.split('\n'), cut = lines.length > maxLines;
  const body = (cut ? lines.slice(0, maxLines) : lines).join('\n').replace(/\s+$/, '');
  const longest = Math.max(2, ...(body.match(/`+/g) || []).map((s) => s.length));
  const f = '`'.repeat(longest + 1);
  return `### ${label} — \`${p}\`${cut ? ` (first ${maxLines} of ${lines.length} lines)` : ''}\n\n${f}${p.endsWith('.md') ? 'markdown' : 'js'}\n${body}\n${f}\n`;
}

function propDirs() {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('_')) continue;
      const p = path.join(d, e.name);
      if (fs.existsSync(path.join(p, 'index.js'))) out.push(p); else walk(p);
    }
  };
  if (fs.existsSync(abs('props'))) walk(abs('props'));
  return out;
}

const skill = readIf('skills/vox-prop/SKILL.md');
if (!skill) { console.error('skills/vox-prop/SKILL.md not found'); process.exit(1); }

const dirs = propDirs();
const existing = [];
for (const d of dirs) {
  try {
    const m = (await import(pathToFileURL(path.join(d, 'index.js')).href)).default.meta;
    existing.push(`- \`${m.name}\` (${m.category ?? '?'}): ${m.use}`);
  } catch (e) { existing.push(`- ${path.basename(d)}: (failed to load: ${e.message})`); }
}

const likeNames = flag('like', 'stamp').split(',').map((s) => s.trim()).filter(Boolean);
const refs = [];
for (const n of likeNames) {
  const d = dirs.find((x) => path.basename(x) === n);
  if (!d) { console.warn(`warning: no kit prop named "${n}"`); continue; }
  refs.push(fenced(`Reference prop: ${n}`, path.relative(ROOT, path.join(d, 'index.js')), 340));
}

const sources = [
  ['Prop protocol', 'props/PROTOCOL.md', 200],
  ['Template', 'props/_template/index.js', 80],
  ['Style rules', 'STYLE.md', 150],
  ['Theme (all colours, fonts, formats)', 'core/theme.js', 120],
  ['Easing (EASES, helpers)', 'core/easing.js', 200],
  ['Core helpers', 'core/helpers.js', 450],
  ['Kit: look helpers', 'props/_shared/look.js', 200],
  ['Kit: shapes helpers', 'props/_shared/shapes.js', 300],
  ['Type grammar the validator applies', 'tools/lib/types.mjs', 200],
  ['Test: every prop must pass', 'tests/props.test.mjs', 250],
  ['Test: import rules', 'tests/imports.test.mjs', 150],
  ['Renderer (read how o and env are built)', 'core/renderer.js', 320],
].map(([l, p, n]) => fenced(l, p, n));

const reqFile = flag('request', null);
const request = reqFile && fs.existsSync(reqFile) ? fs.readFileSync(reqFile, 'utf8').trim() : [
  'Name (camelCase, unique):', 'Where: kit category ___ | project-local in projects/___',
  'What it shows (describe the picture: shapes, layout, motion):', 'Choose it when:',
  'Do NOT use it when (concrete limits: max items, max characters):', 'Slots (name, type, required?):',
  'Options (name, type, default):', 'Timing (how long it stays; how it enters; anything after entering):',
  'Space: world | screen; depth 0..1:', 'How 9:16 and 16:9 should differ:',
  'Reference (describe a picture, or name an existing prop it resembles):', 'Sample content, plus the longest realistic text:',
].map((s) => `- ${s}`).join('\n');

const out = [
  '# Brief: write ONE new prop for this video studio',
  'You cannot run commands in this mode. Follow the SKILL, chat-mode section (reply format: PATH, FILE, SANDBOX, COMMANDS, SELF-CHECK, UNSURE). The source files below are the truth: use only helpers and signatures you can see in them.',
  '\n## Existing props (do not duplicate; your name must be unique)\n', existing.join('\n'),
  '\n---\n\n# SKILL\n', skill.replace(/^---[\s\S]*?---\s*/, ''),
  '\n---\n\n# SOURCE FILES (verbatim)\n', ...sources,
  '\n---\n\n# REFERENCE PROPS (copy their structure)\n', ...refs,
  '\n---\n\n# REQUEST\n', request, '',
].join('\n');

const dest = abs(flag('out', 'PROP_BRIEF.md'));
fs.writeFileSync(dest, out);
const kb = out.length / 1024;
console.log(`wrote ${path.relative(ROOT, dest)} (${kb.toFixed(0)} KB, ~${Math.round(out.length / 4)} tokens est., ${refs.length} reference prop(s))`);
if (kb > 150) console.warn('warning: brief is large; reduce --like or paste into a long-context model');
