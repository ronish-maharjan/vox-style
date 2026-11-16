// props/_shared/paper.js — paper-craft helpers shared by collage props: noise, irregular rim, layered shadow, photo grade, tape, entrance. Import as vox-studio/kit/paper.js
import { paint, font, toRGB, place, margins, anim, num, clamp01, rngFor } from './look.js';
import { outCubic } from './shapes.js';
import { dropShadow } from 'vox-studio/core/helpers.js';

export const LOOKS = {
  bw: { sat: 0, warm: 0.22, con: 1.18 }, muted: { sat: 0.35, warm: 0.25, con: 1.1 },
  color: { sat: 0.85, warm: 0.12, con: 1.05 }, halftone: { sat: 0, warm: 0.2, con: 1.25, dots: 1 },
};
const RIMF = [0.3, 0.6, 0.95, 1.35, 1.8];
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const rgb = (theme, n) => Array.from(toRGB(paint(theme, n)));

/** Integer hash noise in 0..1; 2px blocks mixed with per-pixel give a soft paper fibre. */
export function hash2(a, b, s) {
  let h = Math.imul(a * 374761393 + b * 668265263 + s, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export const grain = (x, y, s) => 0.6 * hash2(x >> 1, y >> 1, s) + 0.4 * hash2(x, y, s);

/** Smooth value noise (bilinear, smoothstep) from hash2. */
export function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Per-pixel edit of a 2d context: fn(data, index, x, y). */
export function edit(g, w, h, fn) {
  const id = g.getImageData(0, 0, w, h), p = id.data;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) fn(p, i, x, y);
  g.putImageData(id, 0, 0);
}

/** New canvas with the alpha of context g and a flat colour. hard=true snaps alpha to 0/255. */
export function tint(env, g, w, h, col, hard) {
  const out = env.createCanvas(w, h), id = g.getImageData(0, 0, w, h), p = id.data;
  for (let i = 0; i < p.length; i += 4) {
    p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2];
    if (hard) p[i + 3] = p[i + 3] > 24 ? 255 : 0;
  }
  out.getContext('2d').putImageData(id, 0, 0);
  return out;
}

/** Silhouette grown by d px (stamped on two rings), placed at (Q,Q) in an sw x sh canvas. */
function dilate(env, sil, sw, sh, Q, d) {
  const c = env.createCanvas(sw, sh), g = c.getContext('2d');
  g.drawImage(sil, Q, Q);
  if (d <= 0) return c;
  for (const [ring, n] of [[1, 36], [0.5, 18]]) {
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; g.drawImage(sil, Q + Math.cos(t) * d * ring, Q + Math.sin(t) * d * ring); }
  }
  return c;
}

/** Contact + ambient shadow and 2px thickness under whatever is opaque in context lg (an sw x sh layer). */
export function shadowUnder(c, env, lg, sw, sh) {
  const { theme } = env, ink = rgb(theme, 'ink');
  const dk = tint(env, lg, sw, sh, rgb(theme, 'paperDark'), false);
  const drop = (alpha, blur, dx, dy) => {
    c.save();
    c.shadowColor = `rgba(${ink[0]},${ink[1]},${ink[2]},${alpha})`;
    c.shadowBlur = blur; c.shadowOffsetX = dx; c.shadowOffsetY = dy;
    c.drawImage(dk, 0, 0);
    c.restore();
  };
  drop(0.24, 26, 6, 14);
  drop(0.38, 4, 2, 3);
  c.drawImage(dk, 1.5, 2.5);
}

/** A finished piece S (w x h canvas) drawn at (Q,Q) of sprite context c, with shadow underneath. */
export function placePiece(c, env, S, w, h, Q) {
  const sw = w + 2 * Q, sh = h + 2 * Q, layer = env.createCanvas(sw, sh), lg = layer.getContext('2d');
  lg.drawImage(S, Q, Q);
  shadowUnder(c, env, lg, sw, sh);
  c.drawImage(S, Q, Q);
}

/** Irregular off-white rim around the alpha of context sg (bw x bh), with shadow, drawn into sprite context c. */
export function paperRim(c, env, sg, { bw, bh, R, Q, rough = 1, sd = 0 }) {
  const { theme } = env, sw = bw + 2 * Q, sh = bh + 2 * Q;
  const white = rgb(theme, 'white'), paper = rgb(theme, 'paper');
  const rimC = white.map((v, i) => Math.round(v * 0.55 + paper[i] * 0.45));
  const sil = tint(env, sg, bw, bh, rimC, true);
  const lv = RIMF.map((f) => dilate(env, sil, sw, sh, Q, Math.round(R * (1 + (f - 1) * rough))).getContext('2d').getImageData(0, 0, sw, sh).data);
  const rl = env.createCanvas(sw, sh), rc = rl.getContext('2d');
  edit(rc, sw, sh, (p, i, x, y) => {
    const n = 0.65 * vnoise(x / 60, y / 60, sd + 3) + 0.35 * vnoise(x / 22, y / 22, sd + 5);
    const t = clamp((n - 0.5) * 2.2 + 0.5, 0, 0.999), g = (grain(x, y, sd + 7) - 0.5) * 8;
    p[i] = rimC[0] + g; p[i + 1] = rimC[1] + g; p[i + 2] = rimC[2] + g;
    p[i + 3] = lv[Math.floor(t * RIMF.length)][i + 3];
  });
  shadowUnder(c, env, rc, sw, sh);
  c.drawImage(rl, 0, 0);
}

/** Photo grade in place: desaturate, contrast, paper tint, light falloff, grain; halftone swaps tone for ink dots. */
export function gradePhoto(sg, bw, bh, env, look, sd) {
  const { theme } = env, ink = rgb(theme, 'ink'), paper = rgb(theme, 'paper'), white = rgb(theme, 'white');
  const L = LOOKS[look] || LOOKS.bw, mul = paper.map((v) => 1 - L.warm + (L.warm * v) / 255);
  const cs = clamp(bw / 110, 4, 8), ca = Math.cos(0.785), sa = Math.sin(0.785);
  edit(sg, bw, bh, (p, i, x, y) => {
    if (!p[i + 3]) return;
    const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    const lit = 1 + 0.07 * (1 - (x / bw + y / bh)), n = (grain(x, y, sd) - 0.5) * 12;
    if (L.dots) {
      const v = clamp((lum - 128) * L.con + 128, 0, 255) / 255;
      const u = x * ca + y * sa, w = y * ca - x * sa;
      const fx = ((u % cs) + cs) % cs - cs / 2, fy = ((w % cs) + cs) % cs - cs / 2;
      const t = clamp(cs * 0.75 * Math.sqrt(1 - v) - Math.hypot(fx, fy) + 0.5, 0, 1) * 0.85 + (1 - v) * 0.15;
      for (let q = 0; q < 3; q++) p[i + q] = (white[q] + (ink[q] - white[q]) * t) * mul[q] * lit + n;
      return;
    }
    for (let q = 0; q < 3; q++) p[i + q] = ((lum + (p[i + q] - lum) * L.sat - 128) * L.con + 128) * mul[q] * lit + n;
  });
}

/** Hatched "missing: file" box for an asset that did not load. */
export function missingBox(g, theme, src, w, h) {
  g.save();
  g.fillStyle = paint(theme, 'paperDark'); g.fillRect(0, 0, w, h);
  g.strokeStyle = paint(theme, 'inkSoft'); g.globalAlpha = 0.35; g.lineWidth = 2;
  for (let q = -h; q < w; q += 28) { g.beginPath(); g.moveTo(q, h); g.lineTo(q + h, 0); g.stroke(); }
  g.globalAlpha = 1; g.fillStyle = paint(theme, 'inkSoft'); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = font(theme, 'text', 28, '600');
  g.fillText(`missing: ${String(src ?? '').split('/').pop()}`, w / 2, h / 2, w * 0.9);
  g.restore();
}

/** Cover-fit an image (or the missing box) into 0,0,w,h. */
export function drawCover(g, env, img, src, w, h) {
  if (!img) return missingBox(g, env.theme, src, w, h);
  const s = Math.max(w / img.width, h / img.height), cw = w / s, ch = h / s;
  g.drawImage(img, (img.width - cw) / 2, (img.height - ch) / 2, cw, ch, 0, 0, w, h);
}

/** Translucent masking-tape strip centred on the origin: zigzag ends, fibre streaks, soft shadow. */
export function tapeStrip(ctx, theme, w, h, rng, color) {
  const n = 6, pts = [];
  for (let i = 0; i <= n; i++) pts.push([w / 2 - (i % 2 ? 7 : 0) - rng.range(0, 2), -h / 2 + (h * i) / n]);
  for (let i = n; i >= 0; i--) pts.push([-w / 2 + (i % 2 ? 7 : 0) + rng.range(0, 2), -h / 2 + (h * i) / n]);
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  ctx.save();
  dropShadow(ctx, theme, () => { ctx.save(); ctx.globalAlpha *= 0.92; path(); ctx.fillStyle = color; ctx.fill(); ctx.restore(); }, {});
  path(); ctx.clip();
  ctx.fillStyle = paint(theme, 'white'); ctx.globalAlpha *= 0.14;
  for (let y = -h / 2 + 3; y < h / 2; y += 4 + rng.range(0, 3)) ctx.fillRect(-w / 2, y, w, 1.2);
  ctx.restore();
}

/** Entrance state: a = eased appear, vis = fade in/out factor. */
export function enterState(o) {
  const { a, x } = anim(o);
  return { a, vis: clamp01(a * 3) * (1 - x) };
}

/** Place the piece: default centre of the safe band, random tilt, rise and settle. Call inside ctx.save(). */
export function stage(ctx, env, o, a, tiltMax = 3) {
  const { W, H } = env, m = margins(env), s = outCubic(clamp01(a / 0.6)), e = 1 - s;
  const tilt = rngFor(env, 'tilt').range(-tiltMax, tiltMax);
  place(ctx, { ...o, x: num(o.x, W / 2), y: num(o.y, (m.top + H - m.bottom) / 2), rot: num(o.rot, tilt) - e * 3, scale: num(o.scale, 1) * (0.9 + 0.1 * s) }, env);
  ctx.translate(0, e * 50);
}
