// props/_shared/look.js — shared helpers for kit props: theme access, placement, cached sprites, assets, tape, rounded rects.
// Usage: import { paint, font, place, cached, imageOf, margins, rngFor, drawTape, toRGB, anim } from 'vox-studio/kit/look.js';
import { sprite, hashStr, seededRandom } from '../../core/helpers.js';

const ALIAS = { tomato: 'accent1', red: 'accent1', cobalt: 'accent2', blue: 'accent2', yellow: 'highlight' };
// Fallback font families used ONLY when the theme does not define them (a registered
// theme always does; these keep project-local props working with a bare theme object).
const FONT_DEFAULT = { display: 'Anton', text: 'Inter', typed: 'Special Elite', serif: 'Libre Baskerville' };

export const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
export const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Theme colour by name ('ink', 'accent1', 'tomato', ...) or a raw CSS colour. */
export function paint(theme, v, fallback = 'ink') {
  const key = ALIAS[v ?? fallback] ?? v ?? fallback;
  const hit = theme?.colors?.[key] ?? theme?.[key];
  return typeof hit === 'string' ? hit : key;
}

export function font(theme, kind, size, weight = '') {
  const f = theme?.fonts?.[kind] ?? theme?.font?.[kind] ?? FONT_DEFAULT[kind] ?? 'sans-serif';
  const fam = /[,"']/.test(f) ? f : `"${f}"`;
  return `${weight ? `${weight} ` : ''}${Math.round(size)}px ${fam}, sans-serif`;
}

/** Appear / exit progress, both 0..1 (exit 0 = not leaving). */
export const anim = (o) => ({ a: clamp01(o.appear ?? 1), x: clamp01(o.exit ?? 0) });

export function margins(env) {
  const s = env.safe ?? {};
  if ('left' in s) return { top: s.top, bottom: s.bottom, left: s.left, right: s.right };
  const x = s.x ?? 0, y = s.y ?? 0, w = s.w ?? s.width ?? env.W, h = s.h ?? s.height ?? env.H;
  return { top: y, left: x, right: env.W - x - w, bottom: env.H - y - h };
}

/** Move origin to the prop centre; apply rot (degrees), scale. Call inside ctx.save(). */
export function place(ctx, o, env) {
  // Default to the SAFE-BAND centre, not the raw screen centre (#3 fix): without this,
  // unpositioned content props sat low in 9:16, inside the caption band.
  const cy = env.safe ? (env.safe.top + env.H - env.safe.bottom) / 2 : env.H / 2;
  ctx.translate(num(o.x, env.W / 2), num(o.y, cy));
  const rot = (num(o.rot, 0) * Math.PI) / 180;
  if (rot) ctx.rotate(rot);
  const s = num(o.scale, 1);
  if (s !== 1) ctx.scale(s, s);
}

/** Memoised offscreen sprite (via core sprite()). drawFn(ctx, w, h). */
export function cached(env, key, w, h, drawFn) {
  const W = Math.ceil(w), H = Math.ceil(h);
  const r = sprite(env, key, W, H, (a) => drawFn(a?.getContext ? a.getContext('2d') : a, W, H));
  return r?.canvas ?? r;
}

/** Loaded image for an asset path, or null (caller draws a placeholder). */
export function imageOf(env, src) {
  let r = null;
  try { const a = env.assets; r = typeof a?.get === 'function' ? a.get(src) : a?.[src]; } catch { r = null; }
  r = r?.img ?? r?.image ?? r?.canvas ?? r;
  return r && r.width > 0 && r.height > 0 ? r : null;
}

export const rngFor = (env, label) => seededRandom(hashStr(`${env.id ?? 'x'}:${label}`));

export function toRGB(css) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(css).trim());
  if (!m) return [0, 0, 0];
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rrect(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** Translucent masking-tape strip with zig-zag ends. */
export function drawTape(ctx, theme, cx, cy, w, h, rotDeg) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.fillStyle = paint(theme, 'tape');
  const hw = w / 2, hh = h / 2, z = h * 0.14, n = 5;
  ctx.beginPath();
  ctx.moveTo(-hw, -hh); ctx.lineTo(hw, -hh);
  for (let i = 1; i <= n; i++) ctx.lineTo(hw + (i % 2 ? -z : 0), -hh + (h * i) / n);
  ctx.lineTo(-hw, hh);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(-hw + (i % 2 ? z : 0), -hh + (h * i) / n);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
