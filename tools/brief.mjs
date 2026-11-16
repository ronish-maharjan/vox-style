// tools/brief.mjs — bundle skill + catalog + assets + a known-good script into one pasteable file.
// Usage: npm run brief -- <project> [--example hk1997] [--topic "text"]   -> projects/<project>/BRIEF.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const project = args[0];
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
if (!project || project.startsWith('--')) { console.error('usage: npm run brief -- <project> [--example hk1997] [--topic "…"]'); process.exit(1); }

const readIf = (p) => { const f = path.join(ROOT, p); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; };
const skill = readIf('skills/vox-script/SKILL.md');
const catalog = readIf('CATALOG.md');
if (!skill) { console.error('skills/vox-script/SKILL.md not found'); process.exit(1); }
if (!catalog) { console.error('CATALOG.md not found — run: npm run catalog'); process.exit(1); }

const IMG = /\.(png|jpe?g|webp|gif)$/i, SKIP = new Set(['qa', 'audio', 'node_modules']);
function images(dir) {
  const out = [], abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  const walk = (d, n) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (n < 3 && !SKIP.has(e.name)) walk(p, n + 1); }
      else if (IMG.test(e.name)) out.push(path.relative(ROOT, p));
    }
  };
  walk(abs, 0);
  return out.sort();
}
const assets = [...new Set([...images('assets'), ...images(`projects/${project}`)])];
const exName = flag('example', 'hk1997');
const example = readIf(`projects/${exName}/script.json`);
const topic = flag('topic', '');

const out = [
  `# Brief for projects/${project}/script.json`,
  topic ? `\n**Topic:** ${topic}\n` : '',
  'You cannot run commands in this mode. Self-check against the error table in the skill; the user will run `npm run validate -- ' + project + '` and paste any errors back.',
  '\n## Assets you may use (exact paths; anything else is a placeholder the user must supply)\n',
  assets.length ? assets.map((a) => `- ${a}`).join('\n') : '- (none yet: name the files you need and list them at the end)',
  '\n---\n\n# SKILL\n',
  skill.replace(/^---[\s\S]*?---\s*/, ''),
  '\n---\n\n# CATALOG\n',
  catalog,
  example ? `\n---\n\n# Known-good example (projects/${exName}/script.json)\n\n\`\`\`json\n${example.trim()}\n\`\`\`\n` : '',
].join('\n');

const dest = path.join(ROOT, 'projects', project, 'BRIEF.md');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log(`wrote ${path.relative(ROOT, dest)} (${(out.length / 1024).toFixed(0)} KB, ${assets.length} asset(s))`);
