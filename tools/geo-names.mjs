// tools/geo-names.mjs — list place names baseMap can focus on, with bounding boxes.
// Usage: npm run geo:names [-- <text>] [--json]     e.g. npm run geo:names -- hong
import geo from '../props/maps/baseMap/geo-data.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const q = args.filter((a) => !a.startsWith('--')).join(' ').trim().toLowerCase();
const feats = geo.features ?? [];
const r2 = (v) => +v.toFixed(2);
// b = [west, south, east, north]; padded start point for options.bbox (check it in qa).
const pad = ([w, s, e, n]) => { const p = Math.max(1.5, 0.5 * Math.max(e - w, n - s)); return [w - p, s - p, e + p, n + p].map((v) => +v.toFixed(1)); };

const hits = feats.filter((f) => !q || String(f.n).includes(q) || String(f.a ?? '').includes(q));
if (json) { console.log(JSON.stringify(hits.map((f) => ({ name: f.n, alt: f.a, bbox: f.b })), null, 1)); process.exit(0); }

if (!hits.length) {
  console.log(`no feature matches "${q}" (${feats.length} features total).`);
  const near = feats.filter((f) => String(f.n).startsWith(q.slice(0, 3))).slice(0, 10).map((f) => f.n);
  if (near.length) console.log('similar: ' + near.join(', '));
  process.exit(1);
}
for (const f of hits) {
  const alt = f.a && f.a !== f.n ? `  (also: ${f.a})` : '';
  console.log(`${f.n}${alt}\n    bbox ${JSON.stringify((f.b ?? []).map(r2))}${f.b ? `   suggested options.bbox ${JSON.stringify(pad(f.b))}` : ''}`);
}
console.log(`\n${hits.length} of ${feats.length}. Names are stored lowercase; write them in normal case as in the catalog example ("Hong Kong") and confirm in qa that the area is coloured.`);
