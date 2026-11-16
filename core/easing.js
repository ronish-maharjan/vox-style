// core/easing.js — pure math. Usage: import { seg, ease, easeOutBack, noise } from './easing.js'
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** progress of t inside [a,b], clamped 0..1 */
export const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));

export const linear = (p) => p;
export const easeIn = (p) => p * p * p;
export const easeOut = (p) => 1 - Math.pow(1 - p, 3);
export const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const easeOutBack = (p, s = 1.70158) => { const c = p - 1; return 1 + (s + 1) * c * c * c + s * c * c; };
/** damped spring 0 -> 1 with overshoot; exactly 0 at p<=0 and 1 at p>=1 */
export const spring = (p, freq = 1.5, decay = 6) =>
  p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-decay * p) * Math.cos(p * Math.PI * 2 * freq);

const TABLE = { linear, easeIn, easeOut, easeInOut, easeOutBack, spring };
export const EASES = Object.keys(TABLE);
export function ease(name, p) {
  const f = TABLE[name];
  if (!f) throw new Error(`Unknown ease "${name}". Use one of: ${EASES.join(', ')}`);
  return f(clamp(p));
}

// 1D value noise, deterministic, returns -1..1
function ih(n, seed) {
  let h = (Math.imul(n, 374761393) + Math.imul(seed | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(ih(i, seed), ih(i + 1, seed), u) * 2 - 1;
}
