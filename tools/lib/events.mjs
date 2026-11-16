// SFX event collection from the loaded timeline + script. Pure.
// Explicit: shot.sfx = "whoosh" | {type|name, at, gain} | [...]. Auto: from props that appear and from transitions.
import { parseCue, resolveCueToken } from './cues.mjs';

const num = (...v) => v.find((x) => typeof x === 'number' && Number.isFinite(x));
const OFFSET = /([+-]\d*\.?\d+)s$/;

export const AUTO_LAYER = {
  stamp: { name: 'thud', delay: 0.2, gain: 1 },
  newspaperClip: { name: 'paper', delay: 0.1, gain: 0.9 },
  paperPhoto: { name: 'paper', delay: 0.05, gain: 0.7 },
  highlighter: { name: 'swipe', delay: 0.05, gain: 0.8 },
  markerCircle: { name: 'scribble', delay: 0.05, gain: 0.7 },
  bigNumber: { name: 'pop', delay: 0.05, gain: 0.8 },
  barChart: { name: 'pop', delay: 0.2, gain: 0.7 },
  baseMap: { name: 'paper', delay: 0, gain: 0.5 },
  lowerThird: { name: 'slide', delay: 0, gain: 0.6 },
};
export const AUTO_TRANSITION = { wipe: { name: 'whoosh', gain: 0.9 }, paperSlide: { name: 'slide', gain: 1 } };

export function shapeError(what, obj) {
  const keys = obj && typeof obj === 'object' ? Object.keys(obj).join(', ') : typeof obj;
  return new Error(`Can't find ${what} in the timeline. Keys seen: [${keys}]. Run: npm run sfx -- <project> --dump and paste the output.`);
}

export function shotsOf(tl) {
  const s = tl?.shots ?? (Array.isArray(tl) ? tl : null);
  if (!Array.isArray(s)) throw shapeError('shots[]', tl);
  return s;
}

function wordTime(s, words, lineId) {
  const c = parseCue(s);
  const L = words?.lines?.find((l) => l.id === lineId);
  if (!c || !L) return NaN;
  const idx = resolveCueToken(L.words.map((w) => w.w), c);
  return idx < 0 ? NaN : L.words[idx].start;
}

export function resolveAt(at = 'start', { start, end }, words, lineId) {
  let s = String(at).trim(), off = 0;
  const m = OFFSET.exec(s);
  if (m) { off = parseFloat(m[1]); s = s.slice(0, m.index).trim(); }
  let base;
  if (s === 'start' || s === '') base = start;
  else if (s === 'end') base = end;
  else if (s.startsWith('t:')) base = start + parseFloat(s.slice(2));
  else if (s.startsWith('word:')) base = wordTime(s, words, lineId);
  return Number.isFinite(base) ? base + off : null;
}

export function collectEvents({ tl, script, words, auto = true }) {
  const shots = shotsOf(tl), events = [], notes = [];
  let layerStartMissing = false;
  // Transition sounds derive from the DIRECTOR's timeline (tl.transitions[]), so audio can
  // never disagree with the visual anchor (C1 fix): the sound starts when the visual does,
  // and the last shot is excluded exactly like the director excludes it.
  if (auto && Array.isArray(tl?.transitions)) {
    for (const tr of tl.transitions) {
      const type = tr.prop ?? tr.type, a = AUTO_TRANSITION[type];
      if (a) events.push({ t: Math.max(0, tr.start), name: a.name, gain: a.gain, why: `transition ${type}` });
    }
  }
  shots.forEach((sh, i) => {
    const spec = script.shots?.[i] ?? {};
    const start = num(sh.start, sh.t0, sh.from, sh.begin), end = num(sh.end, sh.t1, sh.to);
    if (start === undefined || end === undefined) throw shapeError('shot start/end', sh);
    const lineId = spec.line ?? spec.lineId;
    for (const x of [].concat(spec.sfx ?? [])) {
      const o = typeof x === 'string' ? { type: x } : x;
      const name = o?.type ?? o?.name ?? o?.sound;
      if (!name) { notes.push(`shot ${i + 1}: sfx entry without a type`); continue; }
      const t = resolveAt(o.at, { start, end }, words, lineId);
      if (t == null) { notes.push(`shot ${i + 1}: can't resolve sfx time "${o.at}"`); continue; }
      events.push({ t: Math.max(0, t), name, gain: o.gain ?? 1, why: 'explicit' });
    }
    if (auto) {
      for (const l of sh.layers ?? []) {
        const a = AUTO_LAYER[l.prop ?? l.name];
        if (!a) continue;
        const ls = num(l.start, l.t0, l.from);
        if (ls === undefined) { layerStartMissing = true; continue; }
        events.push({ t: ls + a.delay, name: a.name, gain: a.gain, why: `${l.prop ?? l.name} appears` });
      }
    }
  });
  if (layerStartMissing) notes.push('layer start times not found in timeline → prop SFX skipped (explicit + transition SFX still work)');
  return { events: events.sort((a, b) => a.t - b.t), notes };
}
