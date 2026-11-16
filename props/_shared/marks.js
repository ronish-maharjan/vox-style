// props/_shared/marks.js — hand-drawn mark helpers for pointing props: wobbly progressive marker strokes, curves, arrowheads, text wrap. Import as vox-studio/kit/marks.js
import { clamp01 } from './look.js';

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Number, "NN%" of base, or "NNpx" to pixels; fb when unusable. */
export function len(v, base, fb) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim(), n = parseFloat(s);
    if (Number.isFinite(n)) return s.endsWith('%') ? (n / 100) * base : n;
  }
  return fb;
}

/** Cubic bezier sampled into n+1 points. */
export function bezier(p0, p1, p2, p3, n = 36) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return out;
}

/** Add points along straight segments so wobble has something to bend. */
export function densify(pts, step = 14) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

/** Slow sideways drift along the line, like a hand holding a marker. Call rng the same way every frame. */
export function wobble(pts, rng, amp) {
  const p1 = rng.range(0, 6.28), p2 = rng.range(0, 6.28), f1 = rng.range(0.012, 0.02), f2 = rng.range(0.03, 0.05);
  let d = 0;
  return pts.map((q, i) => {
    if (i) d += Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    const o = amp * (0.7 * Math.sin(d * f1 + p1) + 0.3 * Math.sin(d * f2 + p2));
    return [q[0] - (ty / l) * o, q[1] + (tx / l) * o];
  });
}

/** Marker stroke along pts, revealed up to progress (0..1), with a thin offset second pass for ink bleed. */
export function strokePts(ctx, pts, color, width, progress = 1) {
  const p = clamp01(progress);
  if (p <= 0 || pts.length < 2) return;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const end = cum[cum.length - 1] * p;
  const pass = (dx, dy, w, al) => {
    ctx.save();
    ctx.globalAlpha *= al; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
    for (let i = 1; i < pts.length; i++) {
      if (cum[i] <= end) { ctx.lineTo(pts[i][0] + dx, pts[i][1] + dy); continue; }
      const t = (end - cum[i - 1]) / (cum[i] - cum[i - 1]);
      ctx.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t + dx, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t + dy);
      break;
    }
    ctx.stroke(); ctx.restore();
  };
  pass(0, 0, width, 1);
  pass(width * 0.08, width * 0.1, width * 0.55, 0.45);
}

/** Open arrowhead polyline [barb, tip, barb] at the end of pts. */
export function arrowHead(pts, size) {
  const t = pts[pts.length - 1], b = pts[Math.max(0, pts.length - 4)], ang = Math.atan2(t[1] - b[1], t[0] - b[0]);
  const barb = (s, k) => [t[0] - Math.cos(ang + s) * size * k, t[1] - Math.sin(ang + s) * size * k];
  return [barb(0.5, 1), t, barb(-0.5, 0.88)];
}

/** Slightly spiralling loop that overshoots its start, like a hand-drawn circle. */
export function ellipsePts(rx, ry, n = 44, start = -2.2, sweep = Math.PI * 2.12) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = start + (sweep * i) / n, k = 1 - 0.05 * (i / n);
    out.push([Math.cos(t) * rx * k, Math.sin(t) * ry * k]);
  }
  return out;
}

/** Greedy word wrap using the font already set on g. Honors \n. */
export function wrapLines(g, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let cur = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = cur ? `${cur} ${w}` : w;
      if (cur && g.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t;
    }
    out.push(cur);
  }
  return out.length ? out : [''];
}
