#!/usr/bin/env node
// audit-roots — lists every use of ROOT in tools/backends/core/preview and says whether it points at
// STUDIO code (stays) or WORKSPACE data (should use WORKSPACE from tools/lib/roots.mjs). Read-only.
// Usage: npm run audit:roots
import fs from 'node:fs';
import path from 'node:path';
import { STUDIO_ROOT, WORKSPACE, isSplit } from './lib/roots.mjs';

const ws = /['"`/](projects|assets|fonts|recipes|models|vendor|align\.config|studio\.config|CATALOG)/;
const st = /['"`/](core|backends|tools|py|preview)['"`/,)]/;
const counts = { workspace: 0, studio: 0, '?': 0 };
function* files(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (/^(node_modules|py|\.git)$/.test(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* files(p); else if (/\.(m?js)$/.test(e.name)) yield p;
  }
}
for (const top of ['tools', 'backends', 'core', 'preview']) {
  const d = path.join(STUDIO_ROOT, top);
  if (!fs.existsSync(d)) continue;
  for (const f of files(d)) fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (!/\bROOT\b/.test(line) || /^\s*(\/\/|import )/.test(line)) return;
    const kind = ws.test(line) ? 'workspace' : st.test(line) ? 'studio' : '?';
    counts[kind]++;
    if (kind !== 'studio') console.log(`${kind.padEnd(9)} ${path.relative(STUDIO_ROOT, f)}:${i + 1}  ${line.trim().slice(0, 110)}`);
  });
}
console.log(`\nSTUDIO_ROOT ${STUDIO_ROOT}\nWORKSPACE   ${WORKSPACE}  (${isSplit ? 'split' : 'same folder — nothing to do yet'})`);
console.log(`ROOT uses: ${counts.workspace} workspace, ${counts.studio} studio (hidden), ${counts['?']} unclear`);
console.log('Plan: replace "workspace" lines with WORKSPACE; for "props" lines scan BOTH studio props and WORKSPACE/props.');
