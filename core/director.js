// core/director.js — script + words -> timeline. Usage: const tl = buildTimeline(script, wordsJson|null, { props }); shotAt(tl, T)
// Time specs: "start" | "end" | "t:1.5" (seconds from the shot/line start) | "word:kong" | "word:the#2" | any of those + "+0.2s"/"-0.1s".
import { clamp } from './easing.js';
import { norm, matchKey, estimateWords } from './words.js';
import { buildChunks } from './captions.js';

const EPS = 1e-6, OFFSET = /([+-]\d*\.?\d+)s$/;

/** c = { start, end, words:[{w,n,start,end}], label } */
export function findWord(q, c) {
  const m = /^(.*?)(?:#(\d+))?$/.exec(String(q).trim()), target = matchKey(m[1]), nth = m[2] ? +m[2] : 1;
  const hits = c.words.filter((w) => matchKey(w.w) === target);
  if (!target || hits.length < nth) {
    throw new Error(`${c.label}: cue "word:${q}" not found${hits.length ? ` (only ${hits.length} match${hits.length > 1 ? 'es' : ''})` : ''}. ` +
      `Cues match the SPOKEN text. Spoken words: ${c.words.map((w) => w.w).join(' ')}`);
  }
  return hits[nth - 1];
}

export function resolveTime(spec, c) {
  if (typeof spec === 'number') return c.start + spec;
  if (typeof spec !== 'string') throw new Error(`${c.label}: time spec must be a string or number, got ${JSON.stringify(spec)}`);
  let s = spec.trim(), off = 0;
  const m = OFFSET.exec(s);
  if (m) { off = parseFloat(m[1]); s = s.slice(0, m.index); }
  let t;
  if (s === 'start') t = c.start;
  else if (s === 'end') t = c.end;
  else if (s.startsWith('t:')) {
    const v = Number(s.slice(2));
    if (!Number.isFinite(v)) throw new Error(`${c.label}: bad time "${spec}"`);
    t = c.start + v;
  } else if (s.startsWith('word:')) t = findWord(s.slice(5), c).start;
  else throw new Error(`${c.label}: bad time "${spec}". Use "start", "end", "t:1.5" or "word:<text>[#n]" (optional "+0.2s")`);
  return t + off;
}

function lineTiming(script, wordsJson) {
  const src = wordsJson || estimateWords(script.lines), byId = new Map((src.lines || []).map((l) => [l.id, l])), seen = new Set();
  return script.lines.map((L, i) => {
    if (!L.id || typeof L.text !== 'string') throw new Error(`lines[${i}] needs "id" and "text"`);
    if (seen.has(L.id)) throw new Error(`duplicate line id "${L.id}"`);
    seen.add(L.id);
    const s = byId.get(L.id);
    if (!s) throw new Error(`words.json has no line "${L.id}" (re-run align)`);
    const words = (s.words || []).map((w) => ({ w: w.w, n: norm(w.w), start: w.start, end: w.end })).filter((w) => w.n);
    for (const w of words) if (!Number.isFinite(w.start) || !Number.isFinite(w.end)) throw new Error(`words.json line "${L.id}": bad time on "${w.w}"`);
    const start = words.length ? words[0].start : s.start ?? 0;
    return { id: L.id, text: L.text, say: L.say ?? L.text, caps: L.caps, start, end: words.length ? words[words.length - 1].end : s.end ?? start + 0.5, words };
  });
}

function inShot(t, shot, label, what) {
  if (t < shot.start - 0.25 || t > shot.end + 0.001) {
    throw new Error(`${label}: ${what} resolves to ${t.toFixed(2)}s, outside this shot (${shot.start.toFixed(2)}–${shot.end.toFixed(2)}s). ` +
      `Pin it to a word inside the shot, or put it in the shot that covers that word.`);
  }
  return clamp(t, shot.start, shot.end);
}

/**
 * Placement sugar (P0.2): "place" on a layer or shot-level "layout" map resolves to
 * concrete x/y percentages inside the safe area, so scripts never need pixel math.
 *   place: "center" | "top" | "bottom" | "upper" | "lower"
 *   place: { "x": "50%", "y": "30%" }          // explicit % placement
 *   place: "stack" / "stack:2"                 // auto-stack slots (see applyLayout)
 * Values are merged into the layer options (an explicit x/y still wins).
 */
export const PLACEMENTS = ['center', 'upper', 'top', 'lower', 'bottom', 'stack'];

/** y centre (as a fraction of H, inside the safe band) for each named placement. */
const PLACE_Y = {
  center: 0.5, upper: 0.34, top: 0.22, lower: 0.66, bottom: 0.78,
};

export function resolvePlace(place, slot = 0, slots = 1) {
  // named spot -> x/y %; stack:N -> even column layout across the safe band
  if (typeof place === 'string') {
    if (place in PLACE_Y) return { x: '50%', y: `${Math.round(PLACE_Y[place] * 100)}%` };
    const st = /^stack(?::(\d+))?\/(\d+)$/.exec(place);
    if (st) { slot = +st[1] || slot; slots = +st[2]; }
    else if (/^stack/.test(place)) { /* use passed slot/slots */ } else return null;
  } else if (place && typeof place === 'object' && !Array.isArray(place)) {
    const out = {};
    if (place.x !== undefined) out.x = String(place.x);
    if (place.y !== undefined) out.y = String(place.y);
    return Object.keys(out).length ? out : null;
  } else return null;
  // stack: slots share the safe band horizontally; slot N of [0..slots)
  const n = Math.max(1, slots), i = Math.min(n - 1, Math.max(0, slot));
  const xPct = n === 1 ? 50 : Math.round(18 + (64 * i) / (n - 1));
  return { x: `${xPct}%`, y: '42%' };
}

function resolveLayer(L, li, shot, props, siblings) {
  const label = `shot ${shot.index + 1} layer ${li + 1} (${L.prop ?? '?'})`;
  if (!L.prop) throw new Error(`${label}: "prop" is required`);
  const prop = props && props[L.prop];
  if (props && !prop) throw new Error(`${label}: unknown prop "${L.prop}". Known: ${Object.keys(props).join(', ') || '(none)'}`);
  const meta = (prop && prop.meta) || {}, c = { start: shot.start, end: shot.end, words: shot.words, label: `${label} at` };
  const atSpec = L.at ?? 'start';
  const start = atSpec === 'end'
    ? Math.max(shot.start, shot.end - (meta.defaultDuration ?? 3))
    : inShot(resolveTime(atSpec, c), shot, label, '"at"');
  let end = shot.end, explicitEnd = false;
  if (L.until !== undefined) { end = Math.min(shot.end, resolveTime(L.until, { ...c, label: `${label} until` })); explicitEnd = true; }
  if (end <= start) throw new Error(`${label}: "until" (${end.toFixed(2)}s) must be after "at" (${start.toFixed(2)}s)`);

  // placement sugar -> options.x/y (explicit geometry always wins)
  const options = { ...(L.options || {}) };
  if (L.place !== undefined) {
    const spot = resolvePlace(L.place, li, siblings);
    if (!spot) throw new Error(`${label}: bad place "${JSON.stringify(L.place)}". Use ${PLACEMENTS.map((p) => `"${p}"`).join(', ')}, "stack:N/M", or {x,y}`);
    if (options.x === undefined && spot.x !== undefined) options.x = spot.x;
    if (options.y === undefined && spot.y !== undefined) options.y = spot.y;
  }
  return {
    id: L.id ?? `s${shot.index + 1}l${li + 1}-${L.prop}`, prop: L.prop, slots: L.slots || {}, options,
    depth: L.depth ?? meta.depth ?? 0.5, z: L.z ?? 0, order: li, space: L.space ?? meta.space ?? 'world',
    start, end, explicitEnd, enter: L.enter, exit: L.exit, target: L.target, place: L.place,
  };
}

export function buildTimeline(script, wordsJson = null, { props = null, tail = 0.8 } = {}) {
  if (!Array.isArray(script.lines) || !script.lines.length) throw new Error('script.lines must be a non-empty array');
  if (!Array.isArray(script.shots) || !script.shots.length) throw new Error('script.shots must be a non-empty array');
  const lines = lineTiming(script, wordsJson), byId = new Map(lines.map((l) => [l.id, l]));
  const total = Math.max(...lines.map((l) => l.end)) + tail;

  const raw = script.shots.map((s, i) => {
    const line = byId.get(s.line);
    if (!line) throw new Error(`shot ${i + 1}: unknown line "${s.line}". Lines: ${[...byId.keys()].join(', ')}`);
    const sib = script.shots.filter((x) => x.line === s.line).length;
    if (sib > 1 && !s.span) throw new Error(`shot ${i + 1}: line "${s.line}" has ${sib} shots, so each needs "span": [from, to]`);
    const c = { start: line.start, end: line.end, words: line.words, label: `shot ${i + 1} (line ${s.line}) span` }, [from = 'start', to] = s.span || [];
    return { s, i, line, start: resolveTime(from, c), spanEnd: to === undefined ? null : resolveTime(to, c) };
  });
  raw[0].start = 0;                                           // lead-in belongs to shot 1
  raw.forEach((r, i) => {
    const n = raw[i + 1];
    if (n && n.start < r.start - EPS) throw new Error(`shot ${i + 2} starts (${n.start.toFixed(2)}s) before shot ${i + 1} (${r.start.toFixed(2)}s). Order shots like the narration.`);
    if (n && r.spanEnd !== null && r.spanEnd > n.start + 0.02) throw new Error(`shot ${i + 1} span ends (${r.spanEnd.toFixed(2)}s) after shot ${i + 2} starts (${n.start.toFixed(2)}s)`);
    r.end = n ? n.start : Math.max(total, r.spanEnd ?? 0);    // gaps (silence) stay on the previous shot
    if (r.end - r.start < 0.1) throw new Error(`shot ${i + 1} is only ${(r.end - r.start).toFixed(2)}s long; check spans/cues`);
  });

  const ids = new Set();
  const shots = raw.map((r) => {
    const shot = { index: r.i, line: r.line.id, start: r.start, end: r.end, duration: r.end - r.start, camera: normCam(r.s.camera), words: r.line.words };
    shot.localWords = r.line.words.map((w) => ({ w: w.w, n: w.n, start: w.start - r.start, end: w.end - r.start }));
    shot.layers = (r.s.layers || []).map((L, li) => {
      const out = resolveLayer(L, li, shot, props, (r.s.layers || []).length);
      if (ids.has(out.id)) throw new Error(`duplicate layer id "${out.id}"`);
      ids.add(out.id);
      return out;
    });
    return shot;
  });

  const sfx = [], transitions = [];
  shots.forEach((shot, i) => {
    (script.shots[i].sfx || []).forEach((f, k) => {
      const label = `shot ${i + 1} sfx ${k + 1} (${f.type})`;
      const t = inShot(resolveTime(f.at ?? 'start', { start: shot.start, end: shot.end, words: shot.words, label }), shot, label, '"at"');
      sfx.push({ type: f.type, t, gain: f.gain ?? 1 });
    });
    const tr = script.shots[i].transition;
    if (tr && i < shots.length - 1) {
      if (props && !props[tr.type]) throw new Error(`shot ${i + 1}: unknown transition "${tr.type}". Known: ${Object.keys(props).join(', ')}`);
      const d = tr.duration ?? 0.5;
      transitions.push({ id: `tr${i + 1}-${tr.type}`, prop: tr.type, slots: tr.slots || {}, options: tr.options || {}, start: shot.end - d / 2, end: shot.end + d / 2, boundary: shot.end });
    }
  });
  sfx.sort((a, b) => a.t - b.t);
  return { duration: total, lines, shots, sfx, transitions, captions: buildChunks(lines), estimated: !wordsJson };
}

export function shotAt(tl, T) {
  const S = tl.shots;
  let lo = 0, hi = S.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (S[mid].start <= T) lo = mid; else hi = mid - 1; }
  return S[lo];
}

/** "drift" | {move} | {type} -> {move,...}. A bare string used to be ignored. */
function normCam(c) {
  if (typeof c === 'string') return { move: c };
  if (c && typeof c === 'object') return c.move || !c.type ? c : { ...c, move: c.type };
  return {};
}
