// core/helpers.js — shared craft helpers. Usage: import { tornRect, tape, markerStroke, fitText } from './helpers.js'
// Points are {x,y}. Nothing here reads global state.
import { clamp, lerp, noise } from './easing.js';

// ---------- seeded randomness ----------
export function hashStr(s) {
  let h = 2166136261; s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function seededRandom(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashStr(seed);
  const r = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => Math.floor(r.range(lo, hi + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.sign = () => (r() < 0.5 ? -1 : 1);
  return r;
}

// ---------- units / layout ----------
/** number | "50%" | {portrait,landscape} -> px. base = axis length the % refers to */
export function resolveLen(v, base, orientation = 'portrait') {
  if (v && typeof v === 'object' && !Array.isArray(v)) v = v[orientation] ?? v.default ?? v.portrait ?? v.landscape;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.endsWith('%')) return (parseFloat(s) * base) / 100;
    if (s !== '' && !Number.isNaN(Number(s))) return Number(s);
  }
  return v;
}
/** returns options with x,y,w,h,r resolved to px (centre-based) */
export function resolveGeometry(o, env) {
  const out = { ...o };
  const { W, H, orientation } = env, m = Math.min(W, H);
  for (const k of ['x', 'cx']) if (k in o) out[k] = resolveLen(o[k], W, orientation);
  for (const k of ['y', 'cy']) if (k in o) out[k] = resolveLen(o[k], H, orientation);
  if ('w' in o) out.w = resolveLen(o.w, W, orientation);
  if ('h' in o) out.h = resolveLen(o.h, H, orientation);
  if ('r' in o) out.r = resolveLen(o.r, m, orientation);
  return out;
}
export const safeRect = (env) => ({
  x: env.safe.left, y: env.safe.top,
  w: env.W - env.safe.left - env.safe.right, h: env.H - env.safe.top - env.safe.bottom,
});

// ---------- offscreen sprite memo ----------
/** paint(ctx,w,h) runs once per key; key MUST include every input that changes the pixels */
export function sprite(env, key, w, h, paint) {
  const k = `${key}|${w}x${h}`;
  let c = env.sprites && env.sprites.get(k);
  if (!c) {
    c = env.createCanvas(Math.ceil(w), Math.ceil(h));
    paint(c.getContext('2d'), Math.ceil(w), Math.ceil(h));
    if (env.sprites) env.sprites.set(k, c);
  }
  return c;
}

// ---------- paths ----------
export function pathFromPts(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
}
export function roundedPoly(ctx, pts, r) {
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    if (i === 0) ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
    ctx.arcTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2, r);
  }
  ctx.closePath();
}
export function polylineLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return L;
}
/** evenly spaced points along a polyline */
export function resample(pts, step = 14) {
  if (pts.length < 2) return pts.slice();
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[cum.length - 1];
  if (L === 0) return [pts[0]];
  const n = Math.max(2, Math.ceil(L / step)), out = [];
  let j = 1;
  for (let k = 0; k <= n; k++) {
    const d = (L * k) / n;
    while (j < cum.length - 1 && cum[j] < d) j++;
    const u = (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    out.push({ x: lerp(pts[j - 1].x, pts[j].x, u), y: lerp(pts[j - 1].y, pts[j].y, u) });
  }
  return out;
}
/** hand-wobble: perpendicular jitter (smooth noise + a little white noise). Generate from FULL path, then truncate. */
export function wobblePts(pts, rng, amp = 3, step = 14) {
  const w = resample(pts, step), seed = rng.int(0, 99999);
  return w.map((p, i) => {
    const a = w[Math.max(0, i - 1)], b = w[Math.min(w.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    const o = noise(i * 0.3, seed) * amp + rng.range(-amp, amp) * 0.3;
    return { x: p.x + nx * o, y: p.y + ny * o };
  });
}
/** wobbly closed polygon */
export const roughEdge = (pts, rng, amp = 3, step = 18) => wobblePts([...pts, pts[0]], rng, amp, step).slice(0, -1);

/** torn-paper rectangle centred on (0,0); returns points (fill/clip with pathFromPts) */
export function tornRect(w, h, rng, { amp = 7, step = 16 } = {}) {
  const seed = rng.int(0, 99999), hw = w / 2, hh = h / 2, pts = [];
  const edge = (x0, y0, x1, y1, nx, ny, sd) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i < n; i++) {
      const u = i / n, o = noise(i * 0.45, seed + sd) * amp + rng.range(-amp, amp) * 0.35;
      pts.push({ x: lerp(x0, x1, u) + nx * o, y: lerp(y0, y1, u) + ny * o });
    }
  };
  edge(-hw, -hh, hw, -hh, 0, -1, 1); edge(hw, -hh, hw, hh, 1, 0, 2);
  edge(hw, hh, -hw, hh, 0, 1, 3); edge(-hw, hh, -hw, -hh, -1, 0, 4);
  return pts;
}

// ---------- shadow / tape / marker ----------
/** draws via draw(); shadow offsets are screen-fixed (light from top-left) and scaled with camera zoom */
export function dropShadow(ctx, theme, draw, { lift = 1, color } = {}) {
  const m = ctx.getTransform ? ctx.getTransform() : ctx.currentTransform;
  const k = m ? Math.hypot(m.a, m.b) : 1, s = theme.shadow;
  ctx.save();
  ctx.shadowColor = color || theme.colors.shadow;
  ctx.shadowBlur = s.blur * lift * k;
  ctx.shadowOffsetX = s.dx * lift * k;
  ctx.shadowOffsetY = s.dy * lift * k;
  draw();
  ctx.restore();
}
/** self-drawing marker line. progress 0..1 draws from the start. */
export function markerStroke(ctx, pts, progress, { color = '#000', width = 8, alpha = 0.92, wobble = 3, rng, step = 12 } = {}) {
  const p = clamp(progress);
  if (p <= 0 || pts.length < 2) return;
  const w = rng ? wobblePts(pts, rng, wobble, step) : resample(pts, step);
  const f = (w.length - 1) * p, n = Math.floor(f), part = f - n;
  const out = w.slice(0, n + 1);
  if (n < w.length - 1 && part > 0) out.push({ x: lerp(w[n].x, w[n + 1].x, part), y: lerp(w[n].y, w[n + 1].y, part) });
  if (out.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
  ctx.globalAlpha = alpha * 0.25; ctx.lineWidth = width * 1.3; pathFromPts(ctx, out, false); ctx.stroke();
  ctx.globalAlpha = alpha; ctx.lineWidth = width; pathFromPts(ctx, out, false); ctx.stroke();
  ctx.restore();
}

// ---------- text ----------
export function textWrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxW) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}
/** largest font size that fits maxW x maxH. Returns { size, lines, lineHeight, height, fits } and leaves ctx.font set */
export function fitText(ctx, text, { maxW, maxH, family, weight = '700', maxSize = 96, minSize = 18, lineHeight = 1.15 }) {
  let last;
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = textWrap(ctx, text, maxW);
    const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    const height = lines.length * size * lineHeight;
    last = { size, lines, lineHeight, height, fits: height <= maxH && widest <= maxW };
    if (last.fits) return last;
  }
  return last;   // fits:false -> validator/QA flags it
}
