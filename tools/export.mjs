#!/usr/bin/env node
// export — writes projects/<p>/narration.txt (the spoken text) and prints what audio to make.
// Usage: npm run export -- <project>
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/pyenv.mjs';
import { estimateSeconds } from './lib/match.mjs';

const name = process.argv[2];
if (!name) { console.error('usage: npm run export -- <project>'); process.exit(1); }
const dir = path.join(ROOT, 'projects', name);
const script = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
const lines = (script.lines || []).map((l) => ({ id: l.id, spoken: String(l.say ?? l.text ?? '').trim() }));

const empty = lines.filter((l) => !l.spoken);
if (empty.length) console.warn(`⚠ lines with no text (skipped): ${empty.map((l) => l.id).join(', ')}`);
const spoken = lines.filter((l) => l.spoken);

fs.writeFileSync(path.join(dir, 'narration.txt'), spoken.map((l) => l.spoken).join('\n\n') + '\n');

let total = 0;
console.log(`\n✔ projects/${name}/narration.txt  (${spoken.length} lines, blank line between each)\n`);
for (const l of spoken) {
  const s = estimateSeconds(l.spoken); total += s;
  console.log(`  ${l.id.padEnd(6)} ~${s.toFixed(1)}s  ${l.spoken.split(/\s+/).length} words`);
}
console.log(`\n  ≈ ${total.toFixed(0)}s of speech`);
console.log(`\nMake the audio in any tool, then drop it in projects/${name}/audio/ as EITHER:`);
console.log(`  • one file: narration.wav (or .mp3/.m4a) — the whole text, in order`);
console.log(`  • one file per line: ${spoken.slice(0, 3).map((l) => l.id + '.wav').join(', ')}${spoken.length > 3 ? ', …' : ''}`);
console.log(`Optional music: projects/${name}/audio/music.mp3`);
console.log(`Then: npm run align -- ${name}\n`);
